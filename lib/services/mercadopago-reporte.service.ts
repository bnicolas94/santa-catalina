import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CajaService } from './caja.service'
import { leerEgresosMP, validarPagoContraReporte, type EgresoReporteMP } from '@/lib/mercadopago-reporte'
import { firmarPreviewMP, verificarPreviewMP, type PreviewMP } from '@/lib/mercadopago-preview'
import type { PagoSalienteMP } from '@/lib/mercadopago-egresos'

type Cliente = Pick<Prisma.TransactionClient, 'movimientoCaja' | 'movimientoMercadoPago'>
export interface DecisionMP { id: string; accion: 'crear' | 'vincular'; movimientoId?: string }

async function consultarMP(path: string) {
    const token = process.env.MP_ACCESS_TOKEN
    if (!token) throw new Error('Falta configurar la conexión con Mercado Pago.')
    const response = await fetch(`https://api.mercadopago.com${path}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) throw new Error(`Mercado Pago respondió HTTP ${response.status}. Reintentá la consulta.`)
    return response.json()
}

export async function cuentaVerificada() {
    const cuentaId = process.env.MP_COLLECTOR_ID || '231378824'
    const cuenta = await consultarMP('/users/me')
    if (String(cuenta.id) !== cuentaId) throw new Error('El token de Mercado Pago no corresponde a la cuenta configurada.')
    return cuentaId
}

export async function estadoInterno(cliente: Cliente, fila: EgresoReporteMP) {
    const existente = await cliente.movimientoMercadoPago.findUnique({ where: { mpId: fila.id }, select: { id: true, movimientoCajaId: true } })
    const fecha = Date.parse(fila.fecha)
    const candidatos = await cliente.movimientoCaja.findMany({
        where: {
            cajaOrigen: 'mercado_pago', tipo: 'egreso', estado: 'activo', movimientoMp: null,
            monto: { gte: fila.monto - 0.005, lte: fila.monto + 0.005 },
            fecha: { gte: new Date(fecha - 3 * 86400000), lte: new Date(fecha + 3 * 86400000) },
        },
        select: { id: true, monto: true, fecha: true, concepto: true, descripcion: true },
        orderBy: { fecha: 'desc' },
    })
    return { existente, candidatos }
}

export async function previewReporteMP(csv: string, usuarioId: string) {
    const filas = leerEgresosMP(csv)
    return previewFilasMP(filas, createHash('sha256').update(csv).digest('hex'), usuarioId)
}

export async function previewFilasMP(filas: EgresoReporteMP[], hash: string, usuarioId: string) {
    const cuentaId = await cuentaVerificada()
    const resultados = []
    const elegibles: EgresoReporteMP[] = []
    for (let i = 0; i < filas.length; i += 5) {
        const lote = await Promise.all(filas.slice(i, i + 5).map(async fila => {
            const interno = await estadoInterno(prisma, fila)
            let error: string | null = null
            try {
                const pago = await consultarMP(`/v1/payments/${fila.id}`) as PagoSalienteMP
                error = validarPagoContraReporte(pago, fila, cuentaId)
            } catch (e) { error = e instanceof Error ? e.message : 'No se pudo verificar el pago.' }
            if (interno.existente) error = interno.existente.movimientoCajaId ? 'Ya registrado por ID de Mercado Pago.' : 'Existe registro MP sin vínculo. Requiere revisión.'
            if (!error) elegibles.push(fila)
            return { ...fila, error, candidatos: interno.candidatos }
        }))
        resultados.push(...lote)
    }
    const token = firmarPreviewMP({ usuarioId, cuentaId, hash, filas: elegibles, vence: Date.now() + 15 * 60000 })
    return { resultados, token, totalReporte: filas.reduce((s, f) => s + Math.round(f.monto * 100), 0) / 100 }
}

export async function confirmarReporteMP(token: string, decisiones: DecisionMP[], usuarioId: string) {
    const cuentaId = process.env.MP_COLLECTOR_ID || '231378824'
    const preview = verificarPreviewMP(token, usuarioId, cuentaId)
    return aplicarReporteMP(preview, decisiones, usuarioId)
}

// Uso interno: el proceso automático sólo entrega filas descargadas de la API de la cuenta verificada.
export async function aplicarReporteMP(preview: Pick<PreviewMP, 'cuentaId' | 'hash' | 'filas'>, decisiones: DecisionMP[], usuarioId?: string) {
    const cuentaId = preview.cuentaId
    if (!Array.isArray(decisiones) || !decisiones.length || decisiones.length > 30 || new Set(decisiones.map(d => d.id)).size !== decisiones.length) throw new Error('Seleccioná entre 1 y 30 operaciones distintas.')
    const filas = decisiones.map(d => {
        const fila = preview.filas.find(f => f.id === d.id)
        if (!fila || !['crear', 'vincular'].includes(d.accion) || (d.accion === 'vincular' && typeof d.movimientoId !== 'string')) throw new Error('La selección no corresponde a la vista previa.')
        return { fila, decision: d }
    }).sort((a, b) => a.fila.id.localeCompare(b.fila.id))
    if (await cuentaVerificada() !== cuentaId) throw new Error('La cuenta del reporte no coincide con la conexión de MP.')
    // Volver a verificar estado e importe antes de abrir la transacción.
    for (let i = 0; i < filas.length; i += 5) {
        await Promise.all(filas.slice(i, i + 5).map(async ({ fila }) => {
            const pago = await consultarMP(`/v1/payments/${fila.id}`) as PagoSalienteMP
            const error = validarPagoContraReporte(pago, fila, cuentaId)
            if (error) throw new Error(`${fila.id}: ${error} Volvé a generar la vista previa.`)
        }))
    }
    return prisma.$transaction(async tx => {
        let creados = 0; let vinculados = 0; let yaRegistrados = 0; let descontadoCentavos = 0
        for (const { fila, decision } of filas) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mp-egreso:${fila.id}`}))`
            const { existente, candidatos } = await estadoInterno(tx, fila)
            if (existente) { yaRegistrados++; continue }
            let movimientoId: string
            if (decision.accion === 'vincular') {
                const candidato = candidatos.find(c => c.id === decision.movimientoId)
                if (!candidato) throw new Error('La coincidencia cambió. Volvé a generar la vista previa.')
                movimientoId = candidato.id
                await tx.auditoriaMovimientoCaja.create({ data: {
                    movimientoId, usuarioId, accion: 'MODIFICACION',
                    motivo: `Conciliación MP #${fila.id}. Reporte SHA256 ${preview.hash}. Sin cambio de saldo.`,
                    valoresAnteriores: { mpId: null }, valoresNuevos: { mpId: fila.id },
                } })
                vinculados++
            } else {
                if (candidatos.length) throw new Error(`El pago ${fila.id} tiene posibles coincidencias. Revisalas antes de incorporarlo.`)
                const movimiento = await CajaService.createMovimientoEnTx(tx, {
                    tipo: 'egreso', cajaOrigen: 'mercado_pago', medioPago: 'transferencia', monto: fila.monto,
                    concepto: 'Egreso Mercado Pago', fecha: new Date(fila.fecha), usuarioId,
                    descripcion: `REPORTE MP #${fila.id} | SHA256 ${preview.hash}`,
                })
                movimientoId = movimiento.id; creados++; descontadoCentavos += Math.round(fila.monto * 100)
            }
            await tx.movimientoMercadoPago.create({ data: {
                mpId: fila.id, tipo: 'egreso', montoBruto: fila.monto, montoNeto: fila.monto, comisionMp: 0,
                metodoPago: 'account_money', estado: 'approved', fechaCreacionMp: new Date(fila.fecha),
                descripcion: `Conciliado desde reporte SHA256 ${preview.hash}`, movimientoCajaId: movimientoId,
            } })
        }
        return { creados, vinculados, yaRegistrados, descontado: descontadoCentavos / 100 }
    }, { isolationLevel: 'Serializable', timeout: 15000 })
}
