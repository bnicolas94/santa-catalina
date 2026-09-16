import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { evaluarFilaSheet, normalizarTexto, parsearCsvSheetCaja, type FilaSheetCaja } from '@/lib/google-sheets-caja'
import { CajaService } from '@/lib/services/caja.service'

const CONFIG_KEY = 'google-sheets:caja:config:v1'
const ESTADO_KEY = 'google-sheets:caja:estado:v1'
const LEASE_KEY = 'google-sheets:caja:lease:v1'
const SPREADSHEET_PREDETERMINADO = '1ZTPwFz6ZECN5D_E0K81ZrnncqhaoiBMHwQOORKi-U7U'

export interface ConfiguracionSheetCaja {
    activo: boolean
    spreadsheetId: string
    hojas: { nombre: string; gid: string }[]
    intervaloMinutos: number
    fechaInicio: string | null
    actualizadoPorId?: string
}

export interface EstadoSheetCaja {
    ultimaEjecucion?: string
    ultimaSincronizacion?: string
    proximaEjecucion?: string
    filasLeidas: number
    incorporados: number
    pendientes: number
    revisiones: number
    error?: string
}

const configuracionInicial = (): ConfiguracionSheetCaja => ({
    activo: false,
    spreadsheetId: SPREADSHEET_PREDETERMINADO,
    hojas: [{ nombre: 'Pedidos_comunes', gid: '0' }, { nombre: 'Pedidos_online', gid: '312758352' }],
    intervaloMinutos: 2,
    fechaInicio: null,
})

function parsearJson<T>(valor: string | undefined, respaldo: T): T {
    try { return valor ? { ...respaldo, ...JSON.parse(valor) } : respaldo } catch { return respaldo }
}

export async function obtenerConfiguracionSheetCaja() {
    const registro = await prisma.configuracionGlobal.findUnique({ where: { clave: CONFIG_KEY } })
    return parsearJson(registro?.valor, configuracionInicial())
}

export async function obtenerEstadoSheetCaja(): Promise<EstadoSheetCaja> {
    const registro = await prisma.configuracionGlobal.findUnique({ where: { clave: ESTADO_KEY } })
    return parsearJson(registro?.valor, { filasLeidas: 0, incorporados: 0, pendientes: 0, revisiones: 0 })
}

export async function guardarConfiguracionSheetCaja(input: unknown, usuarioId: string) {
    if (!input || typeof input !== 'object') throw new Error('Configuración inválida.')
    const actual = await obtenerConfiguracionSheetCaja()
    const datos = input as Partial<ConfiguracionSheetCaja>
    const spreadsheetId = String(datos.spreadsheetId ?? actual.spreadsheetId).trim()
    if (!/^[a-zA-Z0-9_-]{20,}$/.test(spreadsheetId)) throw new Error('El identificador del Google Sheet no es válido.')
    const activo = datos.activo === undefined ? actual.activo : Boolean(datos.activo)
    const intervaloMinutos = Math.max(1, Math.min(30, Number(datos.intervaloMinutos ?? actual.intervaloMinutos) || 2))
    const config: ConfiguracionSheetCaja = {
        ...actual, activo, spreadsheetId, intervaloMinutos, actualizadoPorId: usuarioId,
        fechaInicio: activo && !actual.activo ? new Date().toISOString() : activo ? actual.fechaInicio : null,
    }
    await prisma.configuracionGlobal.upsert({
        where: { clave: CONFIG_KEY }, create: { clave: CONFIG_KEY, valor: JSON.stringify(config) }, update: { valor: JSON.stringify(config) },
    })
    return config
}

export interface ConfiguracionSucursalInput {
    id?: string
    ubicacionTexto: string
    ubicacionId: string
    cajaEfectivoId?: string | null
    cajaTransferenciaId?: string | null
    activo: boolean
}

export async function guardarSucursalesSheet(input: unknown, usuarioId: string) {
    if (!Array.isArray(input)) throw new Error('Las sucursales son inválidas.')
    const filas = input as ConfiguracionSucursalInput[]
    return prisma.$transaction(async tx => {
        const claves = new Set<string>()
        for (const fila of filas) {
            const ubicacionTexto = String(fila.ubicacionTexto || '').trim()
            const ubicacionClave = normalizarTexto(ubicacionTexto)
            if (!ubicacionClave || claves.has(ubicacionClave)) throw new Error('Cada ubicación del Sheet debe tener un nombre diferente.')
            claves.add(ubicacionClave)
            const sede = await tx.ubicacion.findUnique({ where: { id: fila.ubicacionId } })
            if (!sede || !sede.activo) throw new Error(`Seleccioná una sede activa para ${ubicacionTexto}.`)
            const idsCaja = [fila.cajaEfectivoId, fila.cajaTransferenciaId].filter((id): id is string => Boolean(id))
            const cajas = idsCaja.length ? await tx.saldoCaja.findMany({ where: { id: { in: idsCaja }, activo: true }, select: { id: true, ubicacionId: true } }) : []
            if (cajas.length !== new Set(idsCaja).size) throw new Error(`Una caja configurada para ${ubicacionTexto} no existe o está inactiva.`)
            const cajaEfectivo = cajas.find(c => c.id === fila.cajaEfectivoId)
            if (cajaEfectivo && cajaEfectivo.ubicacionId !== fila.ubicacionId) throw new Error(`La caja de efectivo de ${ubicacionTexto} debe pertenecer a esa sede.`)
            const data = { ubicacionTexto, ubicacionClave, ubicacionId: fila.ubicacionId, cajaEfectivoId: fila.cajaEfectivoId || null, cajaTransferenciaId: fila.cajaTransferenciaId || null, activo: Boolean(fila.activo), actualizadoPorId: usuarioId }
            if (fila.id) await tx.integracionSheetSucursal.update({ where: { id: fila.id }, data })
            else await tx.integracionSheetSucursal.upsert({ where: { ubicacionClave }, create: data, update: data })
        }
        return tx.integracionSheetSucursal.findMany({ include: { ubicacion: true, cajaEfectivo: true, cajaTransferencia: true }, orderBy: { ubicacionTexto: 'asc' } })
    }, { isolationLevel: 'Serializable' })
}

async function descargarHoja(spreadsheetId: string, gid: string) {
    const controlador = new AbortController()
    const timeout = setTimeout(() => controlador.abort(), 20000)
    try {
        const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`
        const respuesta = await fetch(url, { cache: 'no-store', signal: controlador.signal })
        if (!respuesta.ok) throw new Error(`Google Sheets respondió ${respuesta.status}. Verificá que el archivo permita lectura mediante enlace.`)
        const texto = await respuesta.text()
        if (texto.length > 10_000_000) throw new Error('La hoja supera el máximo de 10 MB.')
        return texto
    } finally { clearTimeout(timeout) }
}

function datosRegistro(config: ConfiguracionSheetCaja, hoja: string, fila: FilaSheetCaja, estadoProcesamiento: string, detalle: string | null) {
    return {
        spreadsheetId: config.spreadsheetId, hoja, externalId: fila.externalId, fila: fila.fila,
        fechaExterna: fila.fecha, precio: Number.isFinite(fila.precio) ? fila.precio : 0, pago: fila.pago,
        ubicacion: fila.ubicacion, estadoFuente: fila.estadoClave, huellaFinanciera: fila.huellaFinanciera,
        estadoProcesamiento, detalle,
    }
}

async function registrarFila(config: ConfiguracionSheetCaja, hoja: string, fila: FilaSheetCaja, mapeos: Map<string, {
    activo: boolean; cajaEfectivo: { id: string; tipo: string; activo: boolean } | null; cajaTransferencia: { id: string; tipo: string; activo: boolean } | null
}>) {
    const clave = { spreadsheetId_hoja_externalId: { spreadsheetId: config.spreadsheetId, hoja, externalId: fila.externalId } }
    return prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sheet-caja:${config.spreadsheetId}:${hoja}:${fila.externalId}`}))`
        const existente = await tx.movimientoSheetCaja.findUnique({ where: clave })
        const evaluacion = evaluarFilaSheet({ fila, fechaInicio: new Date(config.fechaInicio!), existente })
        if (evaluacion.accion === 'NINGUNA') return 'NINGUNA'
        if (evaluacion.accion === 'REVISION') {
            await tx.movimientoSheetCaja.update({ where: clave, data: { ...datosRegistro(config, hoja, fila, 'REQUIERE_REVISION', evaluacion.detalle), movimientoCajaId: existente?.movimientoCajaId } })
            return 'REVISION'
        }
        if (evaluacion.accion !== 'REGISTRAR') {
            const estado = evaluacion.accion === 'PENDIENTE' ? 'PENDIENTE_DATOS' : evaluacion.accion === 'IGNORAR' ? 'IGNORADO' : 'OBSERVADO'
            await tx.movimientoSheetCaja.upsert({ where: clave, create: datosRegistro(config, hoja, fila, estado, evaluacion.detalle), update: datosRegistro(config, hoja, fila, estado, evaluacion.detalle) })
            return estado
        }
        const mapeo = mapeos.get(fila.ubicacionClave)
        const caja = fila.pagoClave === 'efectivo' ? mapeo?.cajaEfectivo : mapeo?.cajaTransferencia
        if (!mapeo?.activo || !caja?.activo) {
            await tx.movimientoSheetCaja.upsert({ where: clave, create: datosRegistro(config, hoja, fila, 'PENDIENTE_CONFIGURACION', 'Falta configurar una caja activa para esta sucursal y medio de pago.'), update: datosRegistro(config, hoja, fila, 'PENDIENTE_CONFIGURACION', 'Falta configurar una caja activa para esta sucursal y medio de pago.') })
            return 'PENDIENTE_CONFIGURACION'
        }
        const movimiento = await CajaService.createMovimiento({
            tipo: 'ingreso', concepto: 'Venta externa entregada', monto: fila.precio,
            medioPago: fila.pagoClave, cajaOrigen: caja.tipo,
            descripcion: `Google Sheets · ${hoja} · Pedido #${fila.externalId} · ${fila.ubicacion}`,
            fecha: fila.fecha,
        }, tx)
        await tx.movimientoSheetCaja.upsert({
            where: clave,
            create: { ...datosRegistro(config, hoja, fila, 'REGISTRADO', null), movimientoCajaId: movimiento.id },
            update: { ...datosRegistro(config, hoja, fila, 'REGISTRADO', null), movimientoCajaId: movimiento.id },
        })
        return 'REGISTRADO'
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

async function tomarLease() {
    const propietario = randomUUID()
    await prisma.configuracionGlobal.upsert({ where: { clave: LEASE_KEY }, create: { clave: LEASE_KEY, valor: '0' }, update: {} })
    const vencido = new Date(Date.now() - 5 * 60_000)
    const tomado = await prisma.configuracionGlobal.updateMany({
        where: { clave: LEASE_KEY, OR: [{ valor: '0' }, { updatedAt: { lt: vencido } }] }, data: { valor: propietario },
    })
    return tomado.count ? propietario : null
}

export async function sincronizarGoogleSheetsCaja(forzar = false) {
    const config = await obtenerConfiguracionSheetCaja()
    const anterior = await obtenerEstadoSheetCaja()
    if (!config.activo || !config.fechaInicio) return { ...anterior, inactivo: true }
    if (!forzar && anterior.proximaEjecucion && Date.parse(anterior.proximaEjecucion) > Date.now()) return anterior
    const propietario = await tomarLease()
    if (!propietario) return anterior
    const estado: EstadoSheetCaja = { filasLeidas: 0, incorporados: 0, pendientes: 0, revisiones: 0, ultimaEjecucion: new Date().toISOString() }
    try {
        const configuraciones = await prisma.integracionSheetSucursal.findMany({
            include: { cajaEfectivo: { select: { id: true, tipo: true, activo: true } }, cajaTransferencia: { select: { id: true, tipo: true, activo: true } } },
        })
        const mapeos = new Map(configuraciones.map(m => [m.ubicacionClave, m]))
        for (const hoja of config.hojas) {
            const filas = parsearCsvSheetCaja(await descargarHoja(config.spreadsheetId, hoja.gid))
            estado.filasLeidas += filas.length
            const observadas = await prisma.movimientoSheetCaja.findMany({
                where: { spreadsheetId: config.spreadsheetId, hoja: hoja.nombre, externalId: { in: filas.map(f => f.externalId) } },
                select: { externalId: true, estadoFuente: true, huellaFinanciera: true, estadoProcesamiento: true },
            })
            const porId = new Map(observadas.map(o => [o.externalId, o]))
            const baselined = new Set<string>()
            const registrosBase = filas.flatMap(fila => {
                if (porId.has(fila.externalId)) return []
                const evaluacion = evaluarFilaSheet({ fila, fechaInicio: new Date(config.fechaInicio!) })
                if (evaluacion.accion === 'REGISTRAR') return []
                const estadoBase = evaluacion.accion === 'PENDIENTE' ? 'PENDIENTE_DATOS' : evaluacion.accion === 'IGNORAR' ? 'IGNORADO' : 'OBSERVADO'
                baselined.add(fila.externalId)
                return [datosRegistro(config, hoja.nombre, fila, estadoBase, evaluacion.detalle)]
            })
            if (registrosBase.length) {
                await prisma.movimientoSheetCaja.createMany({ data: registrosBase, skipDuplicates: true })
                estado.pendientes += registrosBase.filter(r => r.estadoProcesamiento.startsWith('PENDIENTE')).length
            }
            for (const fila of filas) {
                if (baselined.has(fila.externalId)) continue
                const observada = porId.get(fila.externalId)
                const reintentar = observada && ['PENDIENTE_CONFIGURACION', 'PENDIENTE_DATOS'].includes(observada.estadoProcesamiento)
                if (observada && !reintentar && observada.estadoFuente === fila.estadoClave && observada.huellaFinanciera === fila.huellaFinanciera) continue
                const resultado = await registrarFila(config, hoja.nombre, fila, mapeos)
                if (resultado === 'REGISTRADO') estado.incorporados++
                if (String(resultado).startsWith('PENDIENTE')) estado.pendientes++
                if (resultado === 'REVISION') estado.revisiones++
            }
        }
        estado.ultimaSincronizacion = new Date().toISOString()
        estado.proximaEjecucion = new Date(Date.now() + config.intervaloMinutos * 60_000).toISOString()
    } catch (error) {
        estado.error = error instanceof Error ? error.message : 'No se pudo sincronizar Google Sheets.'
        estado.proximaEjecucion = new Date(Date.now() + config.intervaloMinutos * 60_000).toISOString()
    } finally {
        await prisma.configuracionGlobal.upsert({ where: { clave: ESTADO_KEY }, create: { clave: ESTADO_KEY, valor: JSON.stringify(estado) }, update: { valor: JSON.stringify(estado) } })
        await prisma.configuracionGlobal.updateMany({ where: { clave: LEASE_KEY, valor: propietario }, data: { valor: '0' } })
    }
    return estado
}

export async function resumenGoogleSheetsCaja() {
    const [config, estado, sucursales, recientes] = await Promise.all([
        obtenerConfiguracionSheetCaja(), obtenerEstadoSheetCaja(),
        prisma.integracionSheetSucursal.findMany({ include: { ubicacion: true, cajaEfectivo: true, cajaTransferencia: true }, orderBy: { ubicacionTexto: 'asc' } }),
        prisma.movimientoSheetCaja.findMany({ where: { estadoProcesamiento: { not: 'OBSERVADO' } }, include: { movimientoCaja: true }, orderBy: { updatedAt: 'desc' }, take: 50 }),
    ])
    return { config, estado, sucursales, recientes }
}
