import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decidirEstadoStock, interpretarPaquetes, parsearCsvSheetStock, type FilaSheetStock, type LineaSheetStock } from '@/lib/google-sheets-stock'
import { descargarHoja, obtenerConfiguracionSheetCaja } from '@/lib/services/google-sheets-caja.service'

const CONFIG_KEY = 'google-sheets:stock:config:v1'
const ESTADO_KEY = 'google-sheets:stock:estado:v1'
const LEASE_KEY = 'google-sheets:stock:lease:v1'

type Configuracion = { activo: boolean; activadoEn: string | null; actualizadoPorId?: string }
type Estado = { ultimaEjecucion?: string; ultimaSincronizacion?: string; proximaEjecucion?: string; filasLeidas: number; descontados: number; pendientes: number; revisiones: number; error?: string }

const configInicial: Configuracion = { activo: false, activadoEn: null }
const estadoInicial: Estado = { filasLeidas: 0, descontados: 0, pendientes: 0, revisiones: 0 }

async function leerJson<T>(clave: string, inicial: T): Promise<T> {
    const registro = await prisma.configuracionGlobal.findUnique({ where: { clave } })
    if (!registro) return inicial
    try { return { ...inicial, ...JSON.parse(registro.valor) } } catch { return inicial }
}

async function escribirJson(clave: string, valor: unknown) {
    await prisma.configuracionGlobal.upsert({ where: { clave }, create: { clave, valor: JSON.stringify(valor) }, update: { valor: JSON.stringify(valor) } })
}

export const obtenerConfiguracionSheetStock = () => leerJson(CONFIG_KEY, configInicial)
const obtenerEstadoSheetStock = () => leerJson(ESTADO_KEY, estadoInicial)

function datosFuente(sheetId: string, hoja: string, fila: FilaSheetStock) {
    return {
        spreadsheetId: sheetId, hoja, externalId: fila.externalId, fila: fila.fila,
        productoTexto: fila.productoTexto, cantidadTexto: fila.cantidadTexto,
        ubicacionTexto: fila.ubicacionTexto, estadoFuente: fila.estadoClave, huellaStock: fila.huellaStock,
    }
}

export async function cambiarEstadoSheetStock(activo: boolean, usuarioId: string) {
    const actual = await obtenerConfiguracionSheetStock()
    if (activo && !actual.activo) {
        const sheet = await obtenerConfiguracionSheetCaja()
        if (!sheet.spreadsheetId || !sheet.hojas.length) throw new Error('Configurá primero el Google Sheet en Caja.')
        const hojas = await Promise.all(sheet.hojas.map(async hoja => ({
            nombre: hoja.nombre, filas: parsearCsvSheetStock(await descargarHoja(sheet.spreadsheetId, hoja.gid)),
        })))
        await prisma.$transaction(async tx => {
            for (const hoja of hojas) {
                for (let indice = 0; indice < hoja.filas.length; indice += 500) {
                    const bloque = hoja.filas.slice(indice, indice + 500)
                    await tx.movimientoSheetStock.createMany({
                        data: bloque.map(fila => ({
                            ...datosFuente(sheet.spreadsheetId, hoja.nombre, fila),
                            estadoProcesamiento: fila.estadoClave === 'entregado' ? 'ANTERIOR' : 'OBSERVADO',
                            detalle: fila.estadoClave === 'entregado' ? 'Ya figuraba entregado al activar; no se descuenta retroactivamente.' : null,
                        })), skipDuplicates: true,
                    })
                    const entregados = bloque.filter(fila => fila.estadoClave === 'entregado').map(fila => fila.externalId)
                    if (entregados.length) await tx.movimientoSheetStock.updateMany({ where: {
                        spreadsheetId: sheet.spreadsheetId, hoja: hoja.nombre, externalId: { in: entregados },
                        estadoProcesamiento: { in: ['OBSERVADO', 'PENDIENTE_REVISION'] },
                    }, data: { estadoProcesamiento: 'ANTERIOR', estadoFuente: 'entregado', detalle: 'Ya figuraba entregado al activar; no se descuenta retroactivamente.' } })
                }
            }
            const config = { activo: true, activadoEn: new Date().toISOString(), actualizadoPorId: usuarioId }
            await tx.configuracionGlobal.upsert({ where: { clave: CONFIG_KEY }, create: { clave: CONFIG_KEY, valor: JSON.stringify(config) }, update: { valor: JSON.stringify(config) } })
        }, { timeout: 60_000 })
        return obtenerConfiguracionSheetStock()
    }
    const config = { ...actual, activo, actualizadoPorId: usuarioId }
    await escribirJson(CONFIG_KEY, config)
    return config
}

async function tomarLease() {
    const propietario = randomUUID()
    await prisma.configuracionGlobal.upsert({ where: { clave: LEASE_KEY }, create: { clave: LEASE_KEY, valor: '0' }, update: {} })
    const tomado = await prisma.configuracionGlobal.updateMany({
        where: { clave: LEASE_KEY, OR: [{ valor: '0' }, { updatedAt: { lt: new Date(Date.now() - 5 * 60_000) } }] },
        data: { valor: propietario },
    })
    return tomado.count ? propietario : null
}

async function resolverSede(tx: Prisma.TransactionClient, fila: FilaSheetStock) {
    if (fila.ubicacionClave === 'fabrica') {
        return tx.ubicacion.findFirst({ where: { nombre: { equals: 'Central', mode: 'insensitive' }, tipo: 'FABRICA', activo: true }, select: { id: true, nombre: true } })
    }
    const mapeo = await tx.integracionSheetSucursal.findUnique({ where: { ubicacionClave: fila.ubicacionClave }, include: { ubicacion: true } })
    return mapeo?.activo && mapeo.ubicacion.activo && mapeo.ubicacion.tipo === 'LOCAL'
        ? { id: mapeo.ubicacion.id, nombre: mapeo.ubicacion.nombre } : null
}

async function descontarLineas(tx: Prisma.TransactionClient, registroId: string, sedeId: string, hoja: string, externalId: string, lineas: LineaSheetStock[]) {
    const codigos = [...new Set(lineas.map(linea => linea.codigo))]
    const productos = await tx.producto.findMany({ where: { codigoInterno: { in: codigos }, activo: true }, include: { presentaciones: { where: { activo: true } } } })
    const movimientos: { productoId: string; presentacionId: string; paquetes: number }[] = []
    for (const linea of lineas) {
        const producto = productos.find(item => item.codigoInterno === linea.codigo)
        const presentacion = producto?.presentaciones.find(item => item.cantidad === linea.presentacion)
        if (!producto || !presentacion) throw new Error(`No existe una presentación activa ${linea.codigo} x${linea.presentacion}.`)
        movimientos.push({ productoId: producto.id, presentacionId: presentacion.id, paquetes: linea.paquetes })
    }
    for (const item of movimientos) {
        await tx.stockProducto.upsert({
            where: { productoId_presentacionId_ubicacionId: { productoId: item.productoId, presentacionId: item.presentacionId, ubicacionId: sedeId } },
            create: { productoId: item.productoId, presentacionId: item.presentacionId, cantidad: -item.paquetes, ubicacionId: sedeId },
            update: { cantidad: { decrement: item.paquetes } },
        })
        await tx.movimientoProducto.create({ data: {
            tipo: 'salida_sheet', signo: 'salida', cantidad: item.paquetes,
            productoId: item.productoId, presentacionId: item.presentacionId, ubicacionId: sedeId,
            movimientoSheetStockId: registroId, observaciones: `Google Sheets · ${hoja} · Pedido #${externalId}`,
        } })
    }
}

async function procesarFila(sheetId: string, hoja: string, fila: FilaSheetStock) {
    const clave = { spreadsheetId_hoja_externalId: { spreadsheetId: sheetId, hoja, externalId: fila.externalId } }
    return prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sheet-stock:${sheetId}:${hoja}:${fila.externalId}`}))`
        const configActual = await tx.configuracionGlobal.findUnique({ where: { clave: CONFIG_KEY } })
        if (!configActual || !JSON.parse(configActual.valor).activo) return 'SIN_CAMBIOS'
        const anterior = await tx.movimientoSheetStock.findUnique({ where: clave })
        const decision = decidirEstadoStock(fila, anterior)
        if (decision === 'ANTERIOR' || decision === 'SIN_CAMBIOS') return decision
        if (decision === 'REQUIERE_REVISION') {
            await tx.movimientoSheetStock.update({ where: clave, data: { estadoProcesamiento: 'REQUIERE_REVISION', detalle: 'La fila cambió después del descuento. Revisar manualmente; el stock no se modificó.' } })
            return decision
        }
        const datos = datosFuente(sheetId, hoja, fila)
        if (decision === 'OBSERVADO') {
            await tx.movimientoSheetStock.upsert({ where: clave, create: { ...datos, estadoProcesamiento: 'OBSERVADO' }, update: { ...datos, estadoProcesamiento: 'OBSERVADO', detalle: null } })
            return decision
        }
        const sede = await resolverSede(tx, fila)
        const interpretacion = interpretarPaquetes(fila)
        const detalle = !sede ? `Sin sede activa para «${fila.ubicacionTexto || 'vacía'}».` : interpretacion.detalle
        if (detalle || !sede || !interpretacion.lineas) {
            await tx.movimientoSheetStock.upsert({ where: clave,
                create: { ...datos, estadoProcesamiento: 'PENDIENTE_REVISION', detalle },
                update: { ...datos, estadoProcesamiento: 'PENDIENTE_REVISION', detalle },
            })
            return 'PENDIENTE_REVISION'
        }
        const registro = await tx.movimientoSheetStock.upsert({ where: clave,
            create: { ...datos, estadoProcesamiento: 'DESCONTADO', ubicacionId: sede.id },
            update: { ...datos, estadoProcesamiento: 'DESCONTADO', ubicacionId: sede.id, detalle: null },
        })
        try { await descontarLineas(tx, registro.id, sede.id, hoja, fila.externalId, interpretacion.lineas) }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('No existe una presentación activa')) {
                await tx.movimientoSheetStock.update({ where: { id: registro.id }, data: { estadoProcesamiento: 'PENDIENTE_REVISION', detalle: error.message } })
                return 'PENDIENTE_REVISION'
            }
            throw error
        }
        return 'DESCONTADO'
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 })
}

export async function sincronizarGoogleSheetsStock(forzar = false) {
    const config = await obtenerConfiguracionSheetStock()
    const anterior = await obtenerEstadoSheetStock()
    if (!config.activo) return { ...anterior, inactivo: true }
    if (!forzar && anterior.proximaEjecucion && Date.parse(anterior.proximaEjecucion) > Date.now()) return anterior
    const propietario = await tomarLease()
    if (!propietario) return anterior
    const estado: Estado = { ...estadoInicial, ultimaEjecucion: new Date().toISOString() }
    try {
        const sheet = await obtenerConfiguracionSheetCaja()
        for (const hoja of sheet.hojas) {
            const filas = parsearCsvSheetStock(await descargarHoja(sheet.spreadsheetId, hoja.gid))
            estado.filasLeidas += filas.length
            const existentes = await prisma.movimientoSheetStock.findMany({
                where: { spreadsheetId: sheet.spreadsheetId, hoja: hoja.nombre, externalId: { in: filas.map(fila => fila.externalId) } },
                select: { externalId: true, estadoProcesamiento: true, estadoFuente: true, huellaStock: true },
            })
            const porId = new Map(existentes.map(item => [item.externalId, item]))
            const nuevasObservadas = filas.filter(fila => !porId.has(fila.externalId) && fila.estadoClave !== 'entregado')
            for (let indice = 0; indice < nuevasObservadas.length; indice += 500) {
                await prisma.movimientoSheetStock.createMany({ data: nuevasObservadas.slice(indice, indice + 500).map(fila => ({
                    ...datosFuente(sheet.spreadsheetId, hoja.nombre, fila), estadoProcesamiento: 'OBSERVADO',
                })), skipDuplicates: true })
            }
            for (const fila of filas) {
                const existente = porId.get(fila.externalId)
                if (!existente && fila.estadoClave !== 'entregado') continue
                if (existente && ['DESCONTADO', 'ANTERIOR', 'PENDIENTE_REVISION'].includes(existente.estadoProcesamiento)
                    && existente.estadoFuente === fila.estadoClave && existente.huellaStock === fila.huellaStock) continue
                const resultado = await procesarFila(sheet.spreadsheetId, hoja.nombre, fila)
                if (resultado === 'DESCONTADO') estado.descontados++
                if (resultado === 'PENDIENTE_REVISION') estado.pendientes++
                if (resultado === 'REQUIERE_REVISION') estado.revisiones++
            }
        }
        estado.ultimaSincronizacion = new Date().toISOString()
    } catch (error) {
        estado.error = error instanceof Error ? error.message : 'No se pudo sincronizar el stock.'
    } finally {
        estado.proximaEjecucion = new Date(Date.now() + 2 * 60_000).toISOString()
        await escribirJson(ESTADO_KEY, estado)
        await prisma.configuracionGlobal.updateMany({ where: { clave: LEASE_KEY, valor: propietario }, data: { valor: '0' } })
    }
    return estado
}

export async function resumenGoogleSheetsStock() {
    const [config, estado, pendientes, recientes, totalPendientes, presentaciones, sedes] = await Promise.all([
        obtenerConfiguracionSheetStock(), obtenerEstadoSheetStock(),
        prisma.movimientoSheetStock.findMany({ where: { estadoProcesamiento: { in: ['PENDIENTE_REVISION', 'REQUIERE_REVISION'] } }, include: { ubicacion: true }, orderBy: { updatedAt: 'desc' }, take: 50 }),
        prisma.movimientoSheetStock.findMany({ where: { estadoProcesamiento: 'DESCONTADO' }, include: { ubicacion: true, movimientos: { include: { presentacion: { include: { producto: true } } } } }, orderBy: { updatedAt: 'desc' }, take: 20 }),
        prisma.movimientoSheetStock.count({ where: { estadoProcesamiento: { in: ['PENDIENTE_REVISION', 'REQUIERE_REVISION'] } } }),
        prisma.presentacion.findMany({ where: { activo: true, producto: { activo: true } }, include: { producto: true }, orderBy: { cantidad: 'asc' } }),
        prisma.ubicacion.findMany({ where: { activo: true }, select: { id: true, nombre: true, tipo: true }, orderBy: { nombre: 'asc' } }),
    ])
    return { config, estado, pendientes, recientes, totalPendientes, presentaciones, sedes }
}

type SeleccionManual = { registroId: string; presentacionId: string; ubicacionId: string; paquetes: number }

async function prepararRevision(seleccion: SeleccionManual) {
    if (!Number.isSafeInteger(seleccion.paquetes) || seleccion.paquetes < 1 || seleccion.paquetes > 100) throw new Error('Ingresá una cantidad válida de paquetes.')
    const registro = await prisma.movimientoSheetStock.findUnique({ where: { id: seleccion.registroId } })
    if (!registro || registro.estadoProcesamiento !== 'PENDIENTE_REVISION') throw new Error('Este pedido ya no está pendiente de descuento.')
    const sheet = await obtenerConfiguracionSheetCaja()
    const hoja = sheet.hojas.find(item => item.nombre === registro.hoja)
    if (!hoja || sheet.spreadsheetId !== registro.spreadsheetId) throw new Error('Cambió la configuración del Sheet.')
    const fila = parsearCsvSheetStock(await descargarHoja(sheet.spreadsheetId, hoja.gid)).find(item => item.externalId === registro.externalId)
    if (!fila || fila.estadoClave !== 'entregado' || fila.huellaStock !== registro.huellaStock) throw new Error('El pedido cambió en el Sheet. Sincronizá y volvé a revisarlo.')
    if (fila.conflictoId) throw new Error('El ID tiene datos contradictorios en el Sheet. Corregilo antes de descontar.')
    const [sede, presentacion] = await Promise.all([
        prisma.ubicacion.findUnique({ where: { id: seleccion.ubicacionId } }),
        prisma.presentacion.findUnique({ where: { id: seleccion.presentacionId }, include: { producto: true } }),
    ])
    if (!sede?.activo || !presentacion?.activo || !presentacion.producto.activo) throw new Error('La sede o presentación seleccionada no está activa.')
    if (!['JQ', 'CLA', 'ESP', 'ELE', 'PRE'].includes(presentacion.producto.codigoInterno)) throw new Error('La presentación no corresponde a paquetes de venta.')
    if (fila.ubicacionClave === 'fabrica') {
        if (sede.tipo !== 'FABRICA' || sede.nombre.toLowerCase() !== 'central') throw new Error('Los pedidos de Fábrica deben descontarse de Central.')
    } else {
        const mapeo = await prisma.integracionSheetSucursal.findUnique({ where: { ubicacionClave: fila.ubicacionClave } })
        if (!mapeo?.activo || mapeo.ubicacionId !== sede.id || sede.tipo !== 'LOCAL') throw new Error('La sede elegida no coincide con la ubicación configurada para el Sheet.')
    }
    const unidades = Number(fila.cantidadTexto)
    if (!Number.isSafeInteger(unidades) || unidades !== seleccion.paquetes * presentacion.cantidad) throw new Error('La presentación y los paquetes no coinciden con la cantidad del Sheet.')
    const stock = await prisma.stockProducto.findUnique({ where: { productoId_presentacionId_ubicacionId: { productoId: presentacion.productoId, presentacionId: presentacion.id, ubicacionId: sede.id } } })
    return { registro, fila, sede, presentacion, stockActual: stock?.cantidad ?? 0, stockUpdatedAt: stock?.updatedAt?.toISOString() ?? null }
}

export async function previsualizarDescuentoSheetStock(seleccion: SeleccionManual) {
    const datos = await prepararRevision(seleccion)
    return {
        pedido: `#${datos.registro.externalId}`, hoja: datos.registro.hoja, productoSheet: datos.fila.productoTexto,
        sede: datos.sede.nombre, presentacion: `${datos.presentacion.producto.nombre} x${datos.presentacion.cantidad}`,
        paquetes: seleccion.paquetes, stockActual: datos.stockActual, stockResultante: datos.stockActual - seleccion.paquetes,
        huellaStock: datos.fila.huellaStock, registroUpdatedAt: datos.registro.updatedAt.toISOString(), stockUpdatedAt: datos.stockUpdatedAt,
    }
}

export async function confirmarDescuentoSheetStock(seleccion: SeleccionManual & {
    huellaStock: string; registroUpdatedAt: string; stockActual: number; stockUpdatedAt: string | null
}) {
    const preparado = await prepararRevision(seleccion)
    if (preparado.fila.huellaStock !== seleccion.huellaStock || preparado.registro.updatedAt.toISOString() !== seleccion.registroUpdatedAt
        || preparado.stockActual !== seleccion.stockActual || preparado.stockUpdatedAt !== seleccion.stockUpdatedAt) {
        throw new Error('El pedido o el stock cambió después de la vista previa. Revisalo nuevamente.')
    }
    await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sheet-stock:${preparado.registro.spreadsheetId}:${preparado.registro.hoja}:${preparado.registro.externalId}`}))`
        const registro = await tx.movimientoSheetStock.findUnique({ where: { id: seleccion.registroId } })
        if (!registro || registro.estadoProcesamiento !== 'PENDIENTE_REVISION' || registro.updatedAt.toISOString() !== seleccion.registroUpdatedAt) {
            throw new Error('El pedido ya fue procesado o modificado. Volvé a revisarlo.')
        }
        const stock = await tx.stockProducto.findUnique({ where: { productoId_presentacionId_ubicacionId: {
            productoId: preparado.presentacion.productoId, presentacionId: preparado.presentacion.id, ubicacionId: preparado.sede.id,
        } } })
        if ((stock?.cantidad ?? 0) !== seleccion.stockActual || (stock?.updatedAt?.toISOString() ?? null) !== seleccion.stockUpdatedAt) {
            throw new Error('El stock cambió después de la vista previa. Volvé a revisarlo.')
        }
        await descontarLineas(tx, registro.id, preparado.sede.id, registro.hoja, registro.externalId, [{
            codigo: preparado.presentacion.producto.codigoInterno as LineaSheetStock['codigo'],
            presentacion: preparado.presentacion.cantidad, paquetes: seleccion.paquetes,
        }])
        await tx.movimientoSheetStock.update({ where: { id: registro.id }, data: {
            estadoProcesamiento: 'DESCONTADO', ubicacionId: preparado.sede.id,
            detalle: `Equivalencia confirmada manualmente: ${preparado.presentacion.producto.nombre} x${preparado.presentacion.cantidad} · ${seleccion.paquetes} paquete(s).`,
        } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { descontado: true }
}
