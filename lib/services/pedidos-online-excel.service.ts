import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { descargarHoja } from '@/lib/services/google-sheets-caja.service'
import {
    convertirPedidoOnline, esDelivery, estaCancelado, parsearCsvPedidosOnline,
    type FilaPedidoOnline, type PedidoExcel,
} from '@/lib/pedidos-online-excel'

const CONFIG_KEY = 'pedidos-online:excel:config:v1'
const TOKEN_KEY = 'pedidos-online:excel:token:v1'
const LECTURA_KEY = 'pedidos-online:excel:lectura:v1'
const SPREADSHEET_ID = '1ZTPwFz6ZECN5D_E0K81ZrnncqhaoiBMHwQOORKi-U7U'
const GID = '312758352'

export type ConfiguracionPedidosOnlineExcel = {
    activo: boolean
    spreadsheetId: string
    gid: string
    workbookName: string
    activadoEn: string | null
    actualizadoPorId?: string
}

export const configuracionInicialPedidosOnlineExcel: ConfiguracionPedidosOnlineExcel = {
    activo: false,
    spreadsheetId: SPREADSHEET_ID,
    gid: GID,
    workbookName: 'Pedidos Santa Catalina ultimo - Copia.xlsx',
    activadoEn: null,
}

export async function obtenerConfiguracionPedidosOnlineExcel() {
    const registro = await prisma.configuracionGlobal.findUnique({ where: { clave: CONFIG_KEY } })
    if (!registro) return configuracionInicialPedidosOnlineExcel
    try { return { ...configuracionInicialPedidosOnlineExcel, ...JSON.parse(registro.valor) } as ConfiguracionPedidosOnlineExcel }
    catch { return configuracionInicialPedidosOnlineExcel }
}

export async function configurarDestinoPedidosOnlineExcel(nombre: unknown, usuarioId: string) {
    const actual = await obtenerConfiguracionPedidosOnlineExcel()
    if (actual.activo) throw new Error('Desactivá la integración antes de cambiar el destino.')
    const workbookName = String(nombre ?? '').trim()
    if (!/^Pedidos Santa Catalina ultimo(?: - Copia)?\.xlsx$/i.test(workbookName)) {
        throw new Error('El nombre del libro de destino no es válido.')
    }
    const config = { ...actual, workbookName, actualizadoPorId: usuarioId }
    await prisma.configuracionGlobal.upsert({
        where: { clave: CONFIG_KEY }, create: { clave: CONFIG_KEY, valor: JSON.stringify(config) },
        update: { valor: JSON.stringify(config) },
    })
    return config
}

export async function activarPedidosOnlineExcel(usuarioId: string) {
    const actual = await obtenerConfiguracionPedidosOnlineExcel()
    if (actual.activo) return actual
    if (actual.activadoEn) {
        const config = { ...actual, activo: true, actualizadoPorId: usuarioId }
        await prisma.configuracionGlobal.upsert({
            where: { clave: CONFIG_KEY }, create: { clave: CONFIG_KEY, valor: JSON.stringify(config) },
            update: { valor: JSON.stringify(config) },
        })
        return config
    }
    const csv = await descargarHoja(actual.spreadsheetId, actual.gid)
    const filas = parsearCsvPedidosOnline(csv)
    if (!filas.length) throw new Error('La hoja está vacía; no se puede fijar una línea de inicio segura.')
    const ahora = new Date().toISOString()
    const config = { ...actual, activo: true, activadoEn: ahora, actualizadoPorId: usuarioId }
    await prisma.$transaction(async tx => {
        // La foto de IDs existentes y la activación se confirman juntas.
        for (let i = 0; i < filas.length; i += 500) {
            await tx.pedidoOnlineExcelSync.createMany({
                data: filas.slice(i, i + 500).map(fila => ({
                    spreadsheetId: actual.spreadsheetId, externalId: fila.externalId, sourceRow: fila.fila,
                    sourceHash: fila.huella, sourceStatus: fila.estado, modality: fila.modalidad,
                    state: 'ANTERIOR',
                })),
                skipDuplicates: true,
            })
        }
        await tx.configuracionGlobal.upsert({
            where: { clave: CONFIG_KEY }, create: { clave: CONFIG_KEY, valor: JSON.stringify(config) },
            update: { valor: JSON.stringify(config) },
        })
    }, { timeout: 60_000 })
    return config
}

export async function desactivarPedidosOnlineExcel(usuarioId: string) {
    const actual = await obtenerConfiguracionPedidosOnlineExcel()
    const config = { ...actual, activo: false, actualizadoPorId: usuarioId }
    await prisma.configuracionGlobal.upsert({
        where: { clave: CONFIG_KEY }, create: { clave: CONFIG_KEY, valor: JSON.stringify(config) },
        update: { valor: JSON.stringify(config) },
    })
    return config
}

function estadoFila(fila: FilaPedidoOnline, existente: { state: string; version: number } | null) {
    if (fila.duplicado) return { operation: null, payload: null, state: 'ERROR', error: 'El ID aparece más de una vez en Google Sheets.' }
    if (!esDelivery(fila)) {
        if (!existente?.version) return { operation: null, payload: null, state: 'IGNORADO', error: null }
        return { operation: 'CANCELAR', payload: null, state: 'PENDIENTE', error: null }
    }
    if (estaCancelado(fila)) {
        if (!existente?.version) return { operation: null, payload: null, state: 'CANCELADO', error: null }
        return { operation: 'CANCELAR', payload: null, state: 'PENDIENTE', error: null }
    }
    const convertido = convertirPedidoOnline(fila)
    if (!convertido.pedido) return { operation: null, payload: null, state: 'ERROR', error: convertido.error }
    return { operation: 'GUARDAR', payload: convertido.pedido, state: 'PENDIENTE', error: null }
}

async function registrarCambio(config: ConfiguracionPedidosOnlineExcel, fila: FilaPedidoOnline) {
    await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pedidos-online-excel:${config.spreadsheetId}:${fila.externalId}`}))`
        const clave = { spreadsheetId_externalId: { spreadsheetId: config.spreadsheetId, externalId: fila.externalId } }
        const existente = await tx.pedidoOnlineExcelSync.findUnique({ where: clave })
        if (existente?.state === 'ANTERIOR' || existente?.sourceHash === fila.huella) return
        const decision = estadoFila(fila, existente)
        const datos = {
            sourceRow: fila.fila, sourceHash: fila.huella, sourceStatus: fila.estado,
            modality: fila.modalidad, state: decision.state, operation: decision.operation,
            payload: decision.payload ? decision.payload as unknown as Prisma.InputJsonValue : Prisma.DbNull,
            lastError: decision.error, attempts: 0,
        }
        if (!existente) {
            await tx.pedidoOnlineExcelSync.create({
                data: { spreadsheetId: config.spreadsheetId, externalId: fila.externalId,
                    ...datos, version: decision.operation ? 1 : 0 },
            })
        } else {
            await tx.pedidoOnlineExcelSync.update({
                where: clave, data: { ...datos, version: decision.operation ? { increment: 1 } : existente.version },
            })
        }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function sincronizarPedidosOnlineExcel() {
    const config = await obtenerConfiguracionPedidosOnlineExcel()
    if (!config.activo) return { leidas: 0, activo: false }
    try {
        const csv = await descargarHoja(config.spreadsheetId, config.gid)
        const filas = parsearCsvPedidosOnline(csv)
        if (!filas.length) throw new Error('Google Sheets devolvió una hoja vacía.')
        const existentes = await prisma.pedidoOnlineExcelSync.findMany({
            where: { spreadsheetId: config.spreadsheetId },
            select: { externalId: true, sourceHash: true, state: true },
        })
        const porId = new Map(existentes.map(fila => [fila.externalId, fila]))
        for (const fila of filas) {
            const anterior = porId.get(fila.externalId)
            if (anterior?.state === 'ANTERIOR' || anterior?.sourceHash === fila.huella) continue
            await registrarCambio(config, fila)
        }
        await prisma.configuracionGlobal.upsert({
            where: { clave: LECTURA_KEY },
            create: { clave: LECTURA_KEY, valor: JSON.stringify({ fecha: new Date().toISOString(), error: null }) },
            update: { valor: JSON.stringify({ fecha: new Date().toISOString(), error: null }) },
        })
        return { leidas: filas.length, activo: true }
    } catch (error) {
        try {
            await prisma.configuracionGlobal.upsert({
                where: { clave: LECTURA_KEY },
                create: { clave: LECTURA_KEY, valor: JSON.stringify({ fecha: new Date().toISOString(), error: error instanceof Error ? error.message : 'Error de lectura' }) },
                update: { valor: JSON.stringify({ fecha: new Date().toISOString(), error: error instanceof Error ? error.message : 'Error de lectura' }) },
            })
        } catch { /* El error original conserva el diagnóstico principal. */ }
        throw error
    }
}

export async function resumenPedidosOnlineExcel() {
    const [config, grupos, recientes, token, lectura] = await Promise.all([
        obtenerConfiguracionPedidosOnlineExcel(),
        prisma.pedidoOnlineExcelSync.groupBy({ by: ['state'], _count: { _all: true } }),
        prisma.pedidoOnlineExcelSync.findMany({
            where: { state: { not: 'ANTERIOR' } },
            orderBy: { updatedAt: 'desc' }, take: 30,
            select: { id: true, externalId: true, sourceRow: true, state: true, operation: true, lastError: true, updatedAt: true },
        }),
        prisma.configuracionGlobal.findUnique({ where: { clave: TOKEN_KEY } }),
        prisma.configuracionGlobal.findUnique({ where: { clave: LECTURA_KEY } }),
    ])
    return { config, conteos: Object.fromEntries(grupos.map(g => [g.state, g._count._all])), recientes,
        dispositivoConfigurado: Boolean(token), lectura: lectura ? JSON.parse(lectura.valor) as { fecha: string; error: string | null } : null }
}

function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

export async function emitirTokenPedidosOnlineExcel() {
    const token = randomBytes(32).toString('base64url')
    await prisma.configuracionGlobal.upsert({
        where: { clave: TOKEN_KEY }, create: { clave: TOKEN_KEY, valor: hashToken(token) },
        update: { valor: hashToken(token) },
    })
    return token
}

export async function validarTokenPedidosOnlineExcel(valor: string | null) {
    const token = valor?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1]
    if (!token) return false
    const registro = await prisma.configuracionGlobal.findUnique({ where: { clave: TOKEN_KEY } })
    if (!registro) return false
    const recibido = Buffer.from(hashToken(token), 'hex')
    const esperado = Buffer.from(registro.valor, 'hex')
    return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}

export async function operacionesPendientesPedidosOnlineExcel() {
    const config = await obtenerConfiguracionPedidosOnlineExcel()
    if (!config.activo) return { activo: false, workbookName: config.workbookName, operaciones: [] }
    const filas = await prisma.pedidoOnlineExcelSync.findMany({
        where: { state: 'PENDIENTE', operation: { in: ['GUARDAR', 'CANCELAR'] } },
        orderBy: { createdAt: 'asc' }, take: 10,
        select: { id: true, externalId: true, operation: true, payload: true, version: true },
    })
    return { activo: true, workbookName: config.workbookName, operaciones: filas }
}

export async function confirmarOperacionPedidosOnlineExcel(input: unknown) {
    if (!input || typeof input !== 'object') throw new Error('Confirmación inválida.')
    const datos = input as { id?: unknown; version?: unknown; exito?: unknown; error?: unknown }
    if (typeof datos.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(datos.id) || typeof datos.version !== 'number' || !Number.isSafeInteger(datos.version)) {
        throw new Error('Identificador o versión inválida.')
    }
    const fila = await prisma.pedidoOnlineExcelSync.findUnique({ where: { id: datos.id } })
    if (!fila || fila.state !== 'PENDIENTE' || fila.version !== datos.version) throw new Error('La operación cambió; se debe volver a consultar.')
    const exito = datos.exito === true
    const intentos = fila.attempts + (exito ? 0 : 1)
    const estado = exito ? fila.operation === 'CANCELAR' ? 'CANCELADO' : 'APLICADO' : intentos >= 3 ? 'ERROR' : 'PENDIENTE'
    const resultado = await prisma.pedidoOnlineExcelSync.updateMany({
        where: { id: fila.id, version: fila.version, state: 'PENDIENTE' },
        data: { state: estado, appliedVersion: exito ? fila.version : fila.appliedVersion,
            operation: exito ? null : fila.operation, attempts: intentos,
            lastError: exito ? null : String(datos.error ?? 'Error en Excel').slice(0, 300) },
    })
    if (!resultado.count) throw new Error('La operación cambió; se debe volver a consultar.')
    return { state: estado }
}

export async function reintentarPedidoOnlineExcel(id: string) {
    const fila = await prisma.pedidoOnlineExcelSync.findUnique({ where: { id } })
    if (!fila || fila.state !== 'ERROR' || !fila.operation) throw new Error('Sólo se pueden reintentar errores de escritura en Excel.')
    await prisma.pedidoOnlineExcelSync.update({ where: { id }, data: { state: 'PENDIENTE', attempts: 0, lastError: null } })
}

export async function crearPruebaPedidosOnlineExcel() {
    const config = await obtenerConfiguracionPedidosOnlineExcel()
    if (!config.activo || !config.workbookName.includes(' - Copia.xlsx')) {
        throw new Error('La prueba requiere la integración activa y dirigida a la copia.')
    }
    const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const externalId = `PRUEBA-${randomBytes(8).toString('hex')}`
    const payload: PedidoExcel = {
        fecha, nombre: 'PRUEBA SINCRONIZACIÓN', pedido: '48jyq 48clasicos 8zyh', cantidad: 13,
        calle: 'PRUEBA — BORRAR', telefono: '0000000000', horario: 'Mañana', entrega: fecha,
    }
    const registro = await prisma.pedidoOnlineExcelSync.create({
        data: { spreadsheetId: config.spreadsheetId, externalId, sourceRow: 0, sourceHash: externalId,
            sourceStatus: 'PRUEBA', modality: 'Delivery', payload: payload as unknown as Prisma.InputJsonValue,
            operation: 'GUARDAR', state: 'PENDIENTE', version: 1 },
    })
    return { id: registro.id, externalId }
}

export async function cancelarPruebaPedidosOnlineExcel(id: string) {
    const config = await obtenerConfiguracionPedidosOnlineExcel()
    if (!config.activo || !config.workbookName.includes(' - Copia.xlsx')) throw new Error('La prueba requiere la copia activa.')
    const registro = await prisma.pedidoOnlineExcelSync.findUnique({ where: { id } })
    if (!registro?.externalId.startsWith('PRUEBA-')) throw new Error('Sólo se puede cancelar un pedido de prueba.')
    if (registro.state === 'CANCELADO') return
    await prisma.pedidoOnlineExcelSync.update({ where: { id }, data: {
        state: 'PENDIENTE', operation: 'CANCELAR', payload: Prisma.DbNull,
        version: { increment: 1 }, attempts: 0, lastError: null,
    } })
}
