import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { EgresoReporteMP } from '@/lib/mercadopago-reporte'
import { descargarReporteMP, encontrarReporteMP, solicitarReporteMP, type TrabajoReporteMP } from '@/lib/mercadopago-reportes-api'
import { aplicarReporteMP, cuentaVerificada, estadoInterno, previewFilasMP } from './mercadopago-reporte.service'

const minuto = 60000; const dia = 86400000
const cuenta = () => process.env.MP_COLLECTOR_ID || '231378824'
const clave = () => `mp:reportes:auto:v1:${cuenta()}`
export interface PendienteMP { id: string; error: string; fila?: EgresoReporteMP; hash: string }
export interface EstadoAutomaticoMP {
    inicio: string; hasta: string; ultimoIntento?: string; ultimaActualizacion?: string
    proximoIntento: number; incorporados: number; error?: string
    trabajo?: TrabajoReporteMP & { filas?: EgresoReporteMP[]; hash?: string; indice?: number }
    pendientes: PendienteMP[]
}

export function nuevoEstadoMP(ahora: number): EstadoAutomaticoMP {
    const inicio = new Date(Math.floor(ahora / 1000) * 1000 - 7 * dia).toISOString()
    return { inicio, hasta: inicio, proximoIntento: 0, incorporados: 0, pendientes: [] }
}

// Cada paso se guarda; repetirlo tras una caída es seguro gracias al mpId único y su bloqueo financiero.
export async function avanzarReportesMP(estado: EstadoAutomaticoMP, dependencias: {
    ahora: () => number
    verificar: () => Promise<string>
    encontrar: typeof encontrarReporteMP
    solicitar: typeof solicitarReporteMP
    descargar: typeof descargarReporteMP
    registrar: (fila: EgresoReporteMP, hash: string, cuentaId: string) => Promise<{ creado: boolean; error?: string }>
}) {
    const ahora = dependencias.ahora()
    if (ahora < estado.proximoIntento) return
    estado.ultimoIntento = new Date(ahora).toISOString()
    estado.proximoIntento = ahora + 5 * minuto
    try {
        const cuentaId = await dependencias.verificar()
        if (!estado.trabajo) {
            const hasta = Math.min(Date.parse(estado.hasta) + dia, Math.floor(ahora / 1000) * 1000 - 5 * minuto)
            if (hasta <= Date.parse(estado.hasta)) return
            estado.trabajo = {
                desde: new Date(Math.max(Date.parse(estado.inicio), Date.parse(estado.hasta) - 2 * dia)).toISOString(),
                hasta: new Date(hasta).toISOString(),
            }
        }
        const trabajo = estado.trabajo
        if (!trabajo.filas) {
            trabajo.archivo = await dependencias.encontrar(trabajo, cuentaId)
            if (!trabajo.archivo) {
                if (!trabajo.solicitado || ahora - trabajo.solicitado >= 60 * minuto) {
                    // Se persiste el intento aun ante timeout: primero se busca el archivo en el siguiente ciclo.
                    trabajo.solicitado = ahora
                    await dependencias.solicitar(trabajo)
                    delete estado.error
                }
                return
            }
            const reporte = await dependencias.descargar(trabajo.archivo)
            const hash = createHash('sha256').update(reporte.csv).digest('hex')
            if (estado.pendientes.length + reporte.incidencias.length > 1000) throw new Error('Hay demasiados egresos pendientes; revisalos en Caja para continuar.')
            for (const incidencia of reporte.incidencias) {
                if (!estado.pendientes.some(p => p.id === incidencia.id)) estado.pendientes.push({ ...incidencia, hash })
            }
            trabajo.filas = reporte.filas; trabajo.hash = hash; trabajo.indice = 0
        }
        // Máximo un pago por paso: límites predecibles aun si MP o la base tardan.
        const fila = trabajo.filas[trabajo.indice || 0]
        if (fila) {
            if (estado.pendientes.length >= 1000) throw new Error('Hay demasiados egresos pendientes; revisalos en Caja para continuar.')
            const resultado = await dependencias.registrar(fila, trabajo.hash!, cuentaId)
            estado.pendientes = estado.pendientes.filter(p => p.id !== fila.id)
            if (resultado.error) estado.pendientes.push({ id: fila.id, fila, hash: trabajo.hash!, error: resultado.error })
            if (resultado.creado) estado.incorporados++
            trabajo.indice = (trabajo.indice || 0) + 1
        }
        if ((trabajo.indice || 0) >= trabajo.filas.length) {
            estado.hasta = trabajo.hasta; estado.ultimaActualizacion = new Date(ahora).toISOString()
            delete estado.trabajo
            estado.proximoIntento = ahora + (Date.parse(estado.hasta) < ahora - 60 * minuto ? 1000 : 15 * minuto)
        } else estado.proximoIntento = ahora + 1000
        delete estado.error
    } catch (e) {
        // No almacenar respuestas remotas, credenciales ni detalles SQL.
        estado.error = e instanceof Error && !('code' in e) ? e.message.slice(0, 240) : 'No se pudo completar la actualización. Se reintentará automáticamente.'
    }
}

async function leerEstado() {
    const registro = await prisma.configuracionGlobal.findUnique({ where: { clave: clave() } })
    return registro ? JSON.parse(registro.valor) as EstadoAutomaticoMP : nuevoEstadoMP(Date.now())
}

export async function estadoAutomaticoMP() {
    const estado = await leerEstado()
    return {
        configurado: Boolean(process.env.MP_ACCESS_TOKEN), habilitado: process.env.MP_REPORTES_AUTO !== 'false', inicio: estado.inicio, hasta: estado.ultimaActualizacion ? estado.hasta : null,
        ultimoIntento: estado.ultimoIntento, ultimaActualizacion: estado.ultimaActualizacion, incorporados: estado.incorporados,
        error: estado.error, pendientes: estado.pendientes.length,
        esperandoReporte: Boolean(estado.trabajo && !estado.trabajo.filas),
        procesando: Boolean(estado.trabajo?.filas),
        incidencias: estado.pendientes.slice(0, 30).map(p => ({ id: p.id, error: p.error })),
    }
}

export async function previewPendientesMP(usuarioId: string) {
    const estado = await leerEstado()
    const pendientes = estado.pendientes.filter(p => p.fila)
    // Un lote conserva el hash del reporte original en la auditoría.
    const hash = pendientes[0]?.hash
    const filas = pendientes.filter(p => p.hash === hash).slice(0, 30).map(p => p.fila!)
    if (!filas.length) throw new Error('No hay egresos pendientes que puedan conciliarse como pagos. Consultá el detalle del estado automático.')
    return previewFilasMP(filas, hash!, usuarioId)
}

export async function ejecutarAutomaticoMP() {
    if (!process.env.MP_ACCESS_TOKEN) return estadoAutomaticoMP()
    if ((await leerEstado()).proximoIntento > Date.now()) return estadoAutomaticoMP()
    // Lease con compare-and-swap: coordina cron, botón y réplicas. Se recupera a los dos minutos tras una caída.
    const llave = `${clave()}:lease`
    const actual = await prisma.configuracionGlobal.upsert({ where: { clave: llave }, create: { clave: llave, valor: '0' }, update: {} })
    if (Number(actual.valor.split(':')[0]) > Date.now()) return estadoAutomaticoMP()
    const vence = Date.now() + 120000
    const propietario = `${vence}:${randomUUID()}`
    const tomado = await prisma.configuracionGlobal.updateMany({ where: { clave: llave, valor: actual.valor }, data: { valor: propietario } })
    if (!tomado.count) return estadoAutomaticoMP()
    try {
        const estado = await leerEstado()
        // Limpia pendientes ya resueltos por conciliación manual sin borrar los no verificables.
        if (estado.pendientes.length) {
            const registrados = await prisma.movimientoMercadoPago.findMany({
                where: { mpId: { in: estado.pendientes.map(p => p.id) }, movimientoCajaId: { not: null } }, select: { mpId: true },
            })
            const ids = new Set(registrados.map(r => r.mpId))
            estado.pendientes = estado.pendientes.filter(p => !ids.has(p.id))
        }
        await avanzarReportesMP(estado, {
            ahora: Date.now, verificar: cuentaVerificada, encontrar: encontrarReporteMP,
            solicitar: solicitarReporteMP, descargar: descargarReporteMP,
            registrar: async (fila, hash, cuentaId) => {
                const interno = await estadoInterno(prisma, fila)
                if (interno.existente?.movimientoCajaId) return { creado: false }
                if (interno.existente || interno.candidatos.length) return { creado: false, error: 'Posible carga manual o registro sin vínculo. Revisar antes de descontar.' }
                try {
                    const resultado = await aplicarReporteMP({ cuentaId, hash, filas: [fila] }, [{ id: fila.id, accion: 'crear' }])
                    return { creado: resultado.creados === 1 }
                } catch (e) {
                    // Fallas transitorias deben reintentar la fila; discrepancias verificadas quedan visibles.
                    if (!(e instanceof Error) || 'code' in e || /HTTP|fetch|timeout|abort/i.test(e.message)) throw e
                    return { creado: false, error: e.message.slice(0, 240) }
                }
            },
        })
        // Una instancia que perdió su lease nunca puede pisar el avance de otra.
        await prisma.$transaction(async tx => {
            const propio = await tx.configuracionGlobal.updateMany({ where: { clave: llave, valor: propietario }, data: { valor: propietario } })
            if (!propio.count || Date.now() >= vence) throw new Error('La actualización excedió el tiempo disponible; se retomará automáticamente.')
            await tx.configuracionGlobal.upsert({ where: { clave: clave() }, create: { clave: clave(), valor: JSON.stringify(estado) }, update: { valor: JSON.stringify(estado) } })
        })
    } finally {
        await prisma.configuracionGlobal.updateMany({ where: { clave: llave, valor: propietario }, data: { valor: '0' } })
    }
    return estadoAutomaticoMP()
}
