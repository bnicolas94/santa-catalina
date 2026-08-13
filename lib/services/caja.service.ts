import { prisma } from '@/lib/prisma'
import type { PrismaClient, Prisma } from '@prisma/client'

import { esMovimientoGestionadoPorRRHH, validarMotivoReasignacionCaja } from '@/lib/caja/movimientosProtegidos'
import { validarMotivoAnulacionCaja } from '@/lib/caja/auditoria'

// ─── Tipos ───────────────────────────────────────────────────────────────────
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export interface CreateMovimientoInput {
    tipo: 'ingreso' | 'egreso'
    concepto: string
    monto: number
    medioPago?: string
    cajaOrigen?: string | null
    descripcion?: string | null
    pedidoId?: string | null
    gastoId?: string | null
    rendicionId?: string | null
    prestamoId?: string | null
    cuotaPrestamoId?: string | null
    liquidacionSueldoId?: string | null
    liquidacionFinalId?: string | null
    pagoCierreMensualId?: string | null
    movimientoReversaDeId?: string | null
    usuarioId?: string | null
    fecha?: Date | string | null
}

export interface UpdateMovimientoInput {
    tipo?: string
    concepto?: string
    monto?: number
    medioPago?: string
    cajaOrigen?: string | null
    descripcion?: string | null
    usuarioId?: string | null
    fecha?: Date | string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza una fecha para evitar desfases de zona horaria.
 * - Sin fecha → `new Date()` (hora exacta del servidor)
 * - Fecha string "YYYY-MM-DD" de hoy → `new Date()` (captura hora real de registro)
 * - Fecha string "YYYY-MM-DD" histórica → mediodía UTC para evitar off-by-one
 * - Cualquier otro valor → se parsea directamente
 */
function normalizeFecha(fecha?: Date | string | null): Date {
    if (!fecha) return new Date()
    if (typeof fecha === 'string' && fecha.length === 10) {
        const todayStr = new Date().toISOString().split('T')[0]
        if (fecha === todayStr) return new Date()
        return new Date(fecha + 'T12:00:00Z')
    }
    return new Date(fecha)
}

function snapshotMovimiento(movimiento: Record<string, unknown>): Prisma.InputJsonValue {
    return {
        tipo: String(movimiento.tipo || ''),
        concepto: String(movimiento.concepto || ''),
        monto: Number(movimiento.monto || 0),
        medioPago: String(movimiento.medioPago || ''),
        cajaOrigen: movimiento.cajaOrigen ? String(movimiento.cajaOrigen) : null,
        descripcion: movimiento.descripcion ? String(movimiento.descripcion) : null,
        fecha: movimiento.fecha instanceof Date ? movimiento.fecha.toISOString() : String(movimiento.fecha || ''),
        estado: String(movimiento.estado || 'activo'),
    }
}

async function registrarAuditoria(
    tx: TxClient,
    input: {
        movimientoId: string
        accion: 'CREACION' | 'MODIFICACION' | 'ANULACION' | 'REASIGNACION'
        usuarioId?: string | null
        valoresAnteriores?: Prisma.InputJsonValue
        valoresNuevos?: Prisma.InputJsonValue
        motivo?: string | null
    },
) {
    return (tx as any).auditoriaMovimientoCaja.create({
        data: {
            movimientoId: input.movimientoId,
            accion: input.accion,
            usuarioId: input.usuarioId || null,
            valoresAnteriores: input.valoresAnteriores,
            valoresNuevos: input.valoresNuevos,
            motivo: input.motivo || null,
        },
    })
}

/**
 * Aplica el impacto de un movimiento sobre SaldoCaja.
 * Ingreso → incrementa, Egreso → decrementa.
 * Usa upsert para creación defensiva del registro de saldo si no existiera.
 */
async function aplicarImpactoSaldo(
    tx: TxClient,
    cajaOrigen: string,
    tipo: string,
    monto: number
): Promise<void> {
    if (tipo === 'ingreso') {
        await (tx as any).saldoCaja.upsert({
            where: { tipo: cajaOrigen },
            update: { saldo: { increment: monto } },
            create: { tipo: cajaOrigen, saldo: monto },
        })
    } else {
        await (tx as any).saldoCaja.upsert({
            where: { tipo: cajaOrigen },
            update: { saldo: { decrement: monto } },
            create: { tipo: cajaOrigen, saldo: -monto },
        })
    }
}

/**
 * Revierte el impacto de un movimiento sobre SaldoCaja.
 * Ingreso → decrementa (deshacer la suma), Egreso → incrementa (devolver la resta).
 */
async function revertirImpactoSaldo(
    tx: TxClient,
    cajaOrigen: string,
    tipo: string,
    monto: number
): Promise<void> {
    if (tipo === 'ingreso') {
        await (tx as any).saldoCaja.update({
            where: { tipo: cajaOrigen },
            data: { saldo: { decrement: monto } },
        })
    } else {
        await (tx as any).saldoCaja.update({
            where: { tipo: cajaOrigen },
            data: { saldo: { increment: monto } },
        })
    }
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export class CajaService {

    // ─── Crear Movimiento ────────────────────────────────────────────────────
    /**
     * Crea un MovimientoCaja y actualiza SaldoCaja en una sola transacción.
     * Puede recibir un `tx` externo para participar de una transacción ya abierta
     * (útil cuando otros módulos como stock o liquidaciones necesitan incluir
     * movimientos de caja dentro de su propia transacción).
     */
    static async createMovimiento(input: CreateMovimientoInput, tx?: TxClient) {
        let finalMedioPago = input.medioPago || 'efectivo'
        if (input.cajaOrigen === 'mercado_pago' || input.cajaOrigen === 'mercado_pago_juani') {
            finalMedioPago = 'transferencia'
        }

        const execute = async (client: TxClient) => {
            const mov = await (client as any).movimientoCaja.create({
                data: {
                    tipo: input.tipo,
                    concepto: input.concepto,
                    monto: input.monto,
                    medioPago: finalMedioPago,
                    cajaOrigen: input.cajaOrigen || null,
                    descripcion: input.descripcion || null,
                    pedidoId: input.pedidoId || null,
                    gastoId: input.gastoId || null,
                    rendicionId: input.rendicionId || null,
                    prestamoId: input.prestamoId || null,
                    cuotaPrestamoId: input.cuotaPrestamoId || null,
                    liquidacionSueldoId: input.liquidacionSueldoId || null,
                    liquidacionFinalId: input.liquidacionFinalId || null,
                    pagoCierreMensualId: input.pagoCierreMensualId || null,
                    movimientoReversaDeId: input.movimientoReversaDeId || null,
                    creadoPorId: input.usuarioId || null,
                    fecha: normalizeFecha(input.fecha),
                },
            })

            if (input.cajaOrigen) {
                await aplicarImpactoSaldo(client, input.cajaOrigen, input.tipo, input.monto)
            }

            await registrarAuditoria(client, {
                movimientoId: mov.id,
                accion: 'CREACION',
                usuarioId: input.usuarioId,
                valoresNuevos: snapshotMovimiento(mov),
            })

            return mov
        }

        // Si ya tenemos una transacción externa, la usamos. Si no, creamos una.
        if (tx) return execute(tx)
        return prisma.$transaction((txClient) => execute(txClient))
    }

    // ─── Actualizar Movimiento ───────────────────────────────────────────────
    /**
     * Edita un MovimientoCaja: 
     * 1. Revierte el impacto del movimiento original
     * 2. Aplica los nuevos datos
     * 3. Impacta el saldo con los valores actualizados
     */
    static async updateMovimiento(id: string, input: UpdateMovimientoInput) {
        return prisma.$transaction(async (tx) => {
            const oldMov = await tx.movimientoCaja.findUnique({ where: { id } })
            if (!oldMov) throw new Error('Movimiento no encontrado')
            if (oldMov.estado === 'anulado') throw new Error('Un movimiento anulado no puede modificarse.')
            if (esMovimientoGestionadoPorRRHH(oldMov)) {
                throw new Error('Este movimiento pertenece a RR. HH. y sólo puede corregirse desde el módulo Empleados.')
            }

            const finalCajaOrigen = input.cajaOrigen !== undefined ? input.cajaOrigen : oldMov.cajaOrigen
            let finalMedioPago = input.medioPago !== undefined ? input.medioPago : oldMov.medioPago

            if (finalCajaOrigen === 'mercado_pago' || finalCajaOrigen === 'mercado_pago_juani') {
                finalMedioPago = 'transferencia'
            }

            // 1. Revertir impacto viejo
            if (oldMov.cajaOrigen) {
                await revertirImpactoSaldo(tx, oldMov.cajaOrigen, oldMov.tipo, oldMov.monto)
            }

            // 2. Actualizar el registro
            const mov = await tx.movimientoCaja.update({
                where: { id },
                data: {
                    ...(input.tipo && { tipo: input.tipo }),
                    ...(input.concepto && { concepto: input.concepto }),
                    ...(input.monto !== undefined && { monto: input.monto }),
                    medioPago: finalMedioPago,
                    ...(input.cajaOrigen !== undefined && { cajaOrigen: input.cajaOrigen || null }),
                    ...(input.descripcion !== undefined && { descripcion: input.descripcion || null }),
                    actualizadoPorId: input.usuarioId || null,
                    ...(input.fecha && { fecha: normalizeFecha(input.fecha) }),
                },
            })

            // 3. Aplicar nuevo impacto
            if (mov.cajaOrigen) {
                await aplicarImpactoSaldo(tx, mov.cajaOrigen, mov.tipo, mov.monto)
            }

            await registrarAuditoria(tx, {
                movimientoId: mov.id,
                accion: 'MODIFICACION',
                usuarioId: input.usuarioId,
                valoresAnteriores: snapshotMovimiento(oldMov),
                valoresNuevos: snapshotMovimiento(mov),
            })

            return mov
        })
    }

    // ─── Eliminar Movimiento ─────────────────────────────────────────────────
    /**
     * Revierte el impacto del movimiento en SaldoCaja, revierte el estado de los pedidos asociados a la rendición, y lo elimina.
     */
    static async anularMovimiento(id: string, motivoInformado: unknown, usuarioId?: string | null) {
        const motivo = validarMotivoAnulacionCaja(motivoInformado)
        return prisma.$transaction(async (tx) => {
            const mov = await tx.movimientoCaja.findUnique({ where: { id } })
            if (!mov) return
            if (mov.estado === 'anulado') throw new Error('El movimiento ya se encuentra anulado.')
            if (esMovimientoGestionadoPorRRHH(mov)) {
                throw new Error('Este movimiento pertenece a RR. HH. y no puede anularse desde Caja. Anulá el pago desde Empleados.')
            }

            // Revertir impacto de saldo
            if (mov.cajaOrigen) {
                await revertirImpactoSaldo(tx, mov.cajaOrigen, mov.tipo, mov.monto)
            }

            // Si es un movimiento de rendición de chofer, restaurar los pedidos asociados a pendientes de cobro
            if (mov.concepto === 'rendicion_chofer' && mov.rendicionId) {
                const rendicion = await tx.rendicionChofer.findUnique({
                    where: { id: mov.rendicionId }
                })
                if (rendicion && rendicion.rutaId) {
                    const entregasRuta = await tx.entrega.findMany({
                        where: {
                            rutaId: rendicion.rutaId,
                            pedido: { medioPago: 'efectivo', estado: 'entregado' }
                        },
                        select: { pedidoId: true }
                    })
                    const pedidoIds = entregasRuta.map(e => e.pedidoId)
                    if (pedidoIds.length > 0) {
                        await tx.pedido.updateMany({
                            where: { id: { in: pedidoIds } },
                            data: { abonado: false }
                        })
                    }
                }

                // Mantener el movimiento anulado, pero liberar la rendición que se revierte.
                await tx.movimientoCaja.update({
                    where: { id },
                    data: { rendicionId: null },
                })

                await tx.rendicionChofer.delete({
                    where: { id: mov.rendicionId }
                })
            }

            const anulado = await tx.movimientoCaja.update({
                where: { id },
                data: {
                    estado: 'anulado',
                    anuladoAt: new Date(),
                    anuladoPorId: usuarioId || null,
                    motivoAnulacion: motivo,
                    ...(mov.rendicionId && { rendicionId: null }),
                },
            })

            await registrarAuditoria(tx, {
                movimientoId: id,
                accion: 'ANULACION',
                usuarioId,
                valoresAnteriores: snapshotMovimiento(mov),
                valoresNuevos: snapshotMovimiento(anulado),
                motivo,
            })

            return anulado
        })
    }

    static async reasignarCajaMovimientoRRHH(input: {
        movimientoId: string
        cajaNueva: string
        motivo: unknown
        usuarioId: string
    }) {
        const motivo = validarMotivoReasignacionCaja(input.motivo)
        if (!input.cajaNueva) throw new Error('Seleccioná la nueva caja de origen.')

        return prisma.$transaction(async tx => {
            const lockKey = `reasignar-caja-rrhh:${input.movimientoId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

            const movimiento = await tx.movimientoCaja.findUnique({
                where: { id: input.movimientoId },
                include: { movimientoReversion: { select: { id: true } } },
            })
            if (!movimiento || !esMovimientoGestionadoPorRRHH(movimiento)) {
                throw new Error('El movimiento no existe o no pertenece a un pago gestionado por RR. HH.')
            }
            if (movimiento.tipo !== 'egreso' || !movimiento.cajaOrigen) {
                throw new Error('Sólo se puede reasignar la caja de un egreso original de RR. HH.')
            }
            if (movimiento.movimientoReversaDeId || movimiento.movimientoReversion) {
                throw new Error('El movimiento fue anulado o es una contrapartida y ya no puede reasignarse.')
            }
            if (movimiento.cajaOrigen === input.cajaNueva) {
                throw new Error('La nueva caja debe ser diferente de la caja actual.')
            }
            const caja = await tx.saldoCaja.findUnique({ where: { tipo: input.cajaNueva } })
            if (!caja) throw new Error(`La caja '${input.cajaNueva}' no existe.`)

            const cajaAnterior = movimiento.cajaOrigen
            const medioAnterior = movimiento.medioPago
            const medioNuevo = ['mercado_pago', 'mercado_pago_juani'].includes(input.cajaNueva)
                ? 'transferencia'
                : 'efectivo'

            await revertirImpactoSaldo(tx, cajaAnterior, movimiento.tipo, movimiento.monto)
            const actualizado = await tx.movimientoCaja.update({
                where: { id: movimiento.id },
                data: { cajaOrigen: input.cajaNueva, medioPago: medioNuevo, actualizadoPorId: input.usuarioId },
            })
            await aplicarImpactoSaldo(tx, input.cajaNueva, movimiento.tipo, movimiento.monto)

            if (movimiento.pagoCierreMensualId) {
                await tx.pagoCierreMensual.update({
                    where: { id: movimiento.pagoCierreMensualId },
                    data: { cajaOrigen: input.cajaNueva },
                })
            }
            if (movimiento.prestamoId) {
                await tx.prestamoEmpleado.update({
                    where: { id: movimiento.prestamoId },
                    data: { origenEntrega: input.cajaNueva },
                })
            }
            if (movimiento.cuotaPrestamoId) {
                await tx.cuotaPrestamo.update({
                    where: { id: movimiento.cuotaPrestamoId },
                    data: { origenEntrega: input.cajaNueva },
                })
            }

            const auditoria = await tx.reasignacionCajaRRHH.create({
                data: {
                    movimientoId: movimiento.id,
                    usuarioId: input.usuarioId,
                    cajaAnterior,
                    cajaNueva: input.cajaNueva,
                    medioAnterior,
                    medioNuevo,
                    motivo,
                },
            })
            await registrarAuditoria(tx, {
                movimientoId: movimiento.id,
                accion: 'REASIGNACION',
                usuarioId: input.usuarioId,
                valoresAnteriores: snapshotMovimiento(movimiento),
                valoresNuevos: snapshotMovimiento(actualizado),
                motivo,
            })
            return { movimiento: actualizado, auditoria }
        })
    }

    // ─── Transferencia entre Cajas ───────────────────────────────────────────
    /**
     * Crea un egreso en origen y un ingreso en destino, actualizando ambos saldos.
     */
    static async transferir(origen: string, destino: string, monto: number, fecha?: Date | string | null, usuarioId?: string | null) {
        const customDate = normalizeFecha(fecha)
        const egresoMedio = (origen === 'mercado_pago' || origen === 'mercado_pago_juani') ? 'transferencia' : 'efectivo'
        const ingresoMedio = (destino === 'mercado_pago' || destino === 'mercado_pago_juani') ? 'transferencia' : 'efectivo'

        return prisma.$transaction(async (tx) => {
            // Validar saldo suficiente en caja de origen
            const saldoRecord = await (tx as any).saldoCaja.findUnique({
                where: { tipo: origen }
            })
            const saldoActual = saldoRecord?.saldo ?? 0
            if (saldoActual < monto) {
                throw new Error(`Saldo insuficiente. Disponible: $${saldoActual.toLocaleString('es-AR')}`)
            }

            const egreso = await (tx as any).movimientoCaja.create({
                data: {
                    tipo: 'egreso',
                    concepto: 'transferencia_interna',
                    monto,
                    medioPago: egresoMedio,
                    cajaOrigen: origen,
                    descripcion: `Transferencia hacia ${destino}`,
                    creadoPorId: usuarioId || null,
                    fecha: customDate,
                },
            })

            const ingreso = await (tx as any).movimientoCaja.create({
                data: {
                    tipo: 'ingreso',
                    concepto: 'transferencia_interna',
                    monto,
                    medioPago: ingresoMedio,
                    cajaOrigen: destino,
                    descripcion: `Transferencia desde ${origen}`,
                    creadoPorId: usuarioId || null,
                    fecha: customDate,
                },
            })

            await aplicarImpactoSaldo(tx, origen, 'egreso', monto)
            await aplicarImpactoSaldo(tx, destino, 'ingreso', monto)

            await registrarAuditoria(tx, { movimientoId: egreso.id, accion: 'CREACION', usuarioId, valoresNuevos: snapshotMovimiento(egreso) })
            await registrarAuditoria(tx, { movimientoId: ingreso.id, accion: 'CREACION', usuarioId, valoresNuevos: snapshotMovimiento(ingreso) })

            return { egreso, ingreso }
        })
    }

    // ─── Rendición de Chofer ─────────────────────────────────────────────────
    /**
     * Confirma la rendición del chofer para una ruta específica, crea el movimiento de ingreso y actualiza caja.
     */
    static async confirmarRendicion(
        rutaId: string,
        montoEsperado: number,
        montoEntregado: number,
        observaciones?: string | null,
        usuarioId?: string | null,
    ) {
        const diferencia = montoEntregado - montoEsperado

        return prisma.$transaction(async (tx) => {
            const rutaActual = await tx.ruta.findUnique({
                where: { id: rutaId },
                include: { chofer: true }
            })
            if (!rutaActual) throw new Error('Ruta no encontrada')

            // Validar orden cronológico: no permitir si hay rutas anteriores sin rendir del mismo chofer
            const rutaAnteriorPendiente = await tx.ruta.findFirst({
                where: {
                    choferId: rutaActual.choferId,
                    OR: [
                        { fecha: { lt: rutaActual.fecha } },
                        {
                            fecha: rutaActual.fecha,
                            createdAt: { lt: rutaActual.createdAt }
                        }
                    ],
                    rendicion: null,
                    entregas: {
                        some: {
                            pedido: {
                                medioPago: 'efectivo',
                                estado: 'entregado',
                                abonado: false
                            }
                        }
                    }
                },
                orderBy: [
                    { fecha: 'asc' },
                    { createdAt: 'asc' }
                ]
            })

            if (rutaAnteriorPendiente) {
                const fechaString = new Date(rutaAnteriorPendiente.fecha).toLocaleDateString('es-AR')
                const turnoString = rutaAnteriorPendiente.turno || 'Sin Turno'
                throw new Error(`No se puede rendir esta ruta. El chofer tiene una ruta anterior pendiente del ${fechaString} (Turno: ${turnoString}).`)
            }

            // Crear la rendición asociada a la ruta
            const rendicion = await tx.rendicionChofer.create({
                data: {
                    choferId: rutaActual.choferId,
                    rutaId,
                    montoEsperado,
                    montoEntregado,
                    diferencia,
                    estado: 'controlado',
                    observaciones: observaciones || null,
                },
            })

            // Marcar todos los pedidos en efectivo entregados de esta ruta como abonado
            const entregasRuta = await tx.entrega.findMany({
                where: {
                    rutaId,
                    pedido: {
                        medioPago: 'efectivo',
                        estado: 'entregado',
                        abonado: false
                    }
                },
                select: { pedidoId: true }
            })
            const pedidoIds = entregasRuta.map(e => e.pedidoId)
            if (pedidoIds.length > 0) {
                await tx.pedido.updateMany({
                    where: { id: { in: pedidoIds } },
                    data: { abonado: true }
                })
            }

            const fechaRutaStr = new Date(rutaActual.fecha).toLocaleDateString('es-AR')
            const turnoStr = rutaActual.turno ? ` - Turno ${rutaActual.turno}` : ''
            const desc = `Rendición chofer ${rutaActual.chofer.nombre} - Ruta ${fechaRutaStr}${turnoStr}${diferencia !== 0 ? ` (Dif: $${diferencia.toFixed(2)})` : ''}`

            const movimiento = await (tx as any).movimientoCaja.create({
                data: {
                    tipo: 'ingreso',
                    concepto: 'rendicion_chofer',
                    monto: montoEntregado,
                    medioPago: 'efectivo',
                    cajaOrigen: 'caja_chica',
                    descripcion: desc,
                    rendicionId: rendicion.id,
                    creadoPorId: usuarioId || null,
                    fecha: new Date(),
                },
            })

            await aplicarImpactoSaldo(tx, 'caja_chica', 'ingreso', montoEntregado)
            await registrarAuditoria(tx, {
                movimientoId: movimiento.id,
                accion: 'CREACION',
                usuarioId,
                valoresNuevos: snapshotMovimiento(movimiento),
            })

            return rendicion
        })
    }

    // ─── Helper público para módulos externos ────────────────────────────────
    /**
     * Para uso dentro de transacciones externas (stock, liquidaciones, webhooks).
     * Crea el movimiento e impacta el saldo usando el `tx` que el módulo ya tiene abierto.
     * Equivale a un `createMovimiento` pero garantizando que NO abre su propia transacción.
     */
    static async createMovimientoEnTx(tx: TxClient, input: CreateMovimientoInput) {
        return this.createMovimiento(input, tx)
    }

    /**
     * Revierte un movimiento de caja dentro de una transacción externa.
     * Útil para cuando un módulo externo (ej. liquidaciones DELETE) necesita 
     * revertir el impacto de un movimiento de caja que creó anteriormente.
     */
    static async revertirMovimientoEnTx(tx: TxClient, movimientoId: string) {
        const mov = await (tx as any).movimientoCaja.findUnique({ where: { id: movimientoId } })
        if (!mov) return null

        if (mov.cajaOrigen) {
            await revertirImpactoSaldo(tx, mov.cajaOrigen, mov.tipo, mov.monto)
        }

        await (tx as any).movimientoCaja.delete({ where: { id: movimientoId } })
        return mov
    }

    /**
     * Expone la función de normalización de fecha para uso desde rutas.
     */
    static normalizeFecha = normalizeFecha

    /**
     * Expone la función de impacto directo en saldo para uso desde rutas que 
     * manejan su propia lógica (ej: saldos/route.ts PUT con ajuste/arqueo).
     */
    static aplicarImpactoSaldo = aplicarImpactoSaldo
}
