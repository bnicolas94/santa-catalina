import { prisma } from '@/lib/prisma'
import { CajaService } from '@/lib/services/caja.service'
import { sincronizarEgresosMP } from '@/lib/mercadopago-egresos'

export async function sincronizarMercadoPago(usuarioId?: string) {
    const token = process.env.MP_ACCESS_TOKEN
    if (!token) throw new Error('Falta configurar MP_ACCESS_TOKEN.')
    const cuentaId = process.env.MP_COLLECTOR_ID || '231378824'
    return sincronizarEgresosMP({
        token, cuentaId,
        registrar: async (pago, monto) => prisma.$transaction(async tx => {
            const mpId = String(pago.id)
            // Serializa el mismo pago entre pestañas, usuarios y cron.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mp-egreso:${mpId}`}))`
            const existente = await tx.movimientoMercadoPago.findUnique({ where: { mpId } })
            if (existente) return false
            const registro = await tx.movimientoMercadoPago.create({
                data: {
                    mpId, tipo: 'egreso', estado: 'approved',
                    montoBruto: pago.transaction_amount ?? monto, montoNeto: monto,
                    // Las comisiones del cobrador no son una comisión nuestra.
                    comisionMp: 0,
                    metodoPago: `${pago.payment_type_id}-${pago.payment_method_id}`,
                    fechaCreacionMp: new Date(pago.date_created),
                    fechaAprobacionMp: pago.date_approved ? new Date(pago.date_approved) : null,
                    descripcion: pago.description || `Egreso Mercado Pago #${mpId}`,
                    referenciaExterna: pago.external_reference,
                },
            })
            const movimiento = await CajaService.createMovimientoEnTx(tx, {
                tipo: 'egreso', concepto: pago.description || 'Egreso Mercado Pago',
                monto, medioPago: 'transferencia', cajaOrigen: 'mercado_pago',
                descripcion: `EGRESO MP #${mpId} | ${pago.description || pago.operation_type || 'Pago'}`,
                fecha: new Date(pago.date_approved || pago.date_created), usuarioId,
            })
            await tx.movimientoMercadoPago.update({
                where: { id: registro.id }, data: { movimientoCajaId: movimiento.id },
            })
            return true
        }),
    })
}
