import { prisma } from '@/lib/prisma'
import type { PrismaClient, Prisma } from '@prisma/client'

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
    fecha?: Date | string | null
}

export interface UpdateMovimientoInput {
    tipo?: string
    concepto?: string
    monto?: number
    medioPago?: string
    cajaOrigen?: string | null
    descripcion?: string | null
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
        const execute = async (client: TxClient) => {
            const mov = await (client as any).movimientoCaja.create({
                data: {
                    tipo: input.tipo,
                    concepto: input.concepto,
                    monto: input.monto,
                    medioPago: input.medioPago || 'efectivo',
                    cajaOrigen: input.cajaOrigen || null,
                    descripcion: input.descripcion || null,
                    pedidoId: input.pedidoId || null,
                    gastoId: input.gastoId || null,
                    rendicionId: input.rendicionId || null,
                    fecha: normalizeFecha(input.fecha),
                },
            })

            if (input.cajaOrigen) {
                await aplicarImpactoSaldo(client, input.cajaOrigen, input.tipo, input.monto)
            }

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
                    ...(input.medioPago && { medioPago: input.medioPago }),
                    ...(input.cajaOrigen !== undefined && { cajaOrigen: input.cajaOrigen || null }),
                    ...(input.descripcion !== undefined && { descripcion: input.descripcion || null }),
                    ...(input.fecha && { fecha: normalizeFecha(input.fecha) }),
                },
            })

            // 3. Aplicar nuevo impacto
            if (mov.cajaOrigen) {
                await aplicarImpactoSaldo(tx, mov.cajaOrigen, mov.tipo, mov.monto)
            }

            return mov
        })
    }

    // ─── Eliminar Movimiento ─────────────────────────────────────────────────
    /**
     * Revierte el impacto del movimiento en SaldoCaja y lo elimina.
     */
    static async deleteMovimiento(id: string) {
        return prisma.$transaction(async (tx) => {
            const mov = await tx.movimientoCaja.findUnique({ where: { id } })
            if (!mov) return

            // Revertir impacto
            if (mov.cajaOrigen) {
                await revertirImpactoSaldo(tx, mov.cajaOrigen, mov.tipo, mov.monto)
            }

            await tx.movimientoCaja.delete({ where: { id } })
            return mov
        })
    }

    // ─── Transferencia entre Cajas ───────────────────────────────────────────
    /**
     * Crea un egreso en origen y un ingreso en destino, actualizando ambos saldos.
     */
    static async transferir(origen: string, destino: string, monto: number, fecha?: Date | string | null) {
        const customDate = normalizeFecha(fecha)

        return prisma.$transaction(async (tx) => {
            const egreso = await (tx as any).movimientoCaja.create({
                data: {
                    tipo: 'egreso',
                    concepto: 'transferencia_interna',
                    monto,
                    medioPago: 'efectivo',
                    cajaOrigen: origen,
                    descripcion: `Transferencia hacia ${destino}`,
                    fecha: customDate,
                },
            })

            const ingreso = await (tx as any).movimientoCaja.create({
                data: {
                    tipo: 'ingreso',
                    concepto: 'transferencia_interna',
                    monto,
                    medioPago: 'efectivo',
                    cajaOrigen: destino,
                    descripcion: `Transferencia desde ${origen}`,
                    fecha: customDate,
                },
            })

            await aplicarImpactoSaldo(tx, origen, 'egreso', monto)
            await aplicarImpactoSaldo(tx, destino, 'ingreso', monto)

            return { egreso, ingreso }
        })
    }

    // ─── Rendición de Chofer ─────────────────────────────────────────────────
    /**
     * Confirma la rendición del chofer, crea el movimiento de ingreso y actualiza caja.
     */
    static async confirmarRendicion(
        choferId: string,
        montoEsperado: number,
        montoEntregado: number,
        observaciones?: string | null
    ) {
        const diferencia = montoEntregado - montoEsperado

        return prisma.$transaction(async (tx) => {
            const rendicion = await tx.rendicionChofer.create({
                data: {
                    choferId,
                    montoEsperado,
                    montoEntregado: montoEntregado,
                    diferencia,
                    estado: 'controlado',
                    observaciones: observaciones || null,
                },
            })

            await (tx as any).movimientoCaja.create({
                data: {
                    tipo: 'ingreso',
                    concepto: 'rendicion_chofer',
                    monto: montoEntregado,
                    medioPago: 'efectivo',
                    cajaOrigen: 'caja_chica',
                    descripcion: `Rendición chofer - ${diferencia !== 0 ? `Diferencia: $${diferencia.toFixed(2)}` : 'Sin diferencia'}`,
                    rendicionId: rendicion.id,
                    fecha: new Date(),
                },
            })

            await aplicarImpactoSaldo(tx, 'caja_chica', 'ingreso', montoEntregado)

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
