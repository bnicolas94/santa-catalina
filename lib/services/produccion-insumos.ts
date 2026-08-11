import { Prisma } from '@prisma/client'

const PRECISION = 1_000_000
export const STOCK_TOLERANCE = 0.000001

export interface RecetaInsumo {
    insumoId: string
    cantidadPorUnidad: number
    merma?: number | null
    tipoConsumo?: string | null
    presentacionId?: string | null
}

export interface ConsumoInsumoCalculado {
    insumoId: string
    cantidad: number
}

function roundStock(value: number) {
    return Math.round(value * PRECISION) / PRECISION
}

/**
 * La ficha técnica guarda consumo por unidad vendible (por ejemplo, un sándwich).
 * Producción informa paquetes, por lo que primero se convierten a unidades vendibles.
 */
export function aplicaRecetaAPresentacion(item: RecetaInsumo, presentacionId?: string) {
    return !item.presentacionId || item.presentacionId === presentacionId
}

export function calcularCantidadInsumoPorPaquete(item: RecetaInsumo, unidadesPorPaquete: number) {
    const merma = Math.min(Math.max(Number(item.merma) || 0, 0), 99.99)
    const cantidadNeta = item.tipoConsumo === 'por_paquete'
        ? item.cantidadPorUnidad
        : item.cantidadPorUnidad * unidadesPorPaquete
    return cantidadNeta / (1 - merma / 100)
}

export function calcularConsumosProduccion(
    receta: RecetaInsumo[],
    paquetes: number,
    unidadesPorPaquete: number,
    presentacionId?: string,
): ConsumoInsumoCalculado[] {
    if (!Number.isFinite(paquetes) || paquetes < 0 || !Number.isInteger(paquetes)) {
        throw new Error('La cantidad de paquetes debe ser un entero mayor o igual a cero')
    }
    if (!Number.isFinite(unidadesPorPaquete) || unidadesPorPaquete <= 0 || !Number.isInteger(unidadesPorPaquete)) {
        throw new Error('La presentación debe tener una cantidad válida de unidades')
    }

    return receta
        .filter((item) => aplicaRecetaAPresentacion(item, presentacionId))
        .map((item) => ({
            insumoId: item.insumoId,
            cantidad: roundStock(calcularCantidadInsumoPorPaquete(item, unidadesPorPaquete) * paquetes),
        }))
        .filter((item) => item.cantidad > STOCK_TOLERANCE)
}

type Tx = Prisma.TransactionClient

export async function aplicarDeltaStockInsumo(
    tx: Tx,
    input: {
        insumoId: string
        ubicacionId: string
        deltaStock: number
        loteId?: string
        observaciones: string
    },
) {
    const delta = roundStock(input.deltaStock)
    if (Math.abs(delta) <= STOCK_TOLERANCE) return

    const insumo = await tx.insumo.findUnique({
        where: { id: input.insumoId },
        select: { factorConversion: true },
    })
    if (!insumo) throw new Error(`Insumo ${input.insumoId} no encontrado`)

    const deltaSecundario = insumo.factorConversion && insumo.factorConversion > 0
        ? roundStock(delta / insumo.factorConversion)
        : 0

    await tx.insumo.update({
        where: { id: input.insumoId },
        data: {
            stockActual: { increment: delta },
            stockActualSecundario: { increment: deltaSecundario },
        },
    })

    await tx.stockInsumo.upsert({
        where: {
            insumoId_ubicacionId: {
                insumoId: input.insumoId,
                ubicacionId: input.ubicacionId,
            },
        },
        create: {
            insumoId: input.insumoId,
            ubicacionId: input.ubicacionId,
            cantidad: delta,
            cantidadSecundaria: deltaSecundario,
        },
        update: {
            cantidad: { increment: delta },
            cantidadSecundaria: { increment: deltaSecundario },
        },
    })

    return tx.movimientoStock.create({
        data: {
            insumoId: input.insumoId,
            ubicacionId: input.ubicacionId,
            loteOrigenId: input.loteId || null,
            tipo: delta < 0 ? 'salida' : 'entrada',
            cantidad: Math.abs(delta),
            cantidadSecundaria: Math.abs(deltaSecundario) || null,
            observaciones: input.observaciones,
        },
    })
}

export async function registrarConsumoInicial(
    tx: Tx,
    input: {
        loteId: string
        ubicacionId: string
        consumos: ConsumoInsumoCalculado[]
        personal?: string
    },
) {
    for (const consumo of input.consumos) {
        await aplicarDeltaStockInsumo(tx, {
            insumoId: consumo.insumoId,
            ubicacionId: input.ubicacionId,
            loteId: input.loteId,
            deltaStock: -consumo.cantidad,
            observaciones: `Consumo al iniciar producción — Lote ${input.loteId}${input.personal ? `. Personal: ${input.personal}` : ''}`,
        })
    }
}

/**
 * Lleva el consumo neto del lote al objetivo final mediante movimientos por diferencia.
 * Los movimientos previos se conservan para mantener la trazabilidad.
 */
export async function conciliarConsumoLote(
    tx: Tx,
    input: {
        loteId: string
        ubicacionId: string
        consumosObjetivo: ConsumoInsumoCalculado[]
    },
) {
    const movimientos = await tx.movimientoStock.findMany({
        where: { loteOrigenId: input.loteId },
        select: {
            id: true,
            insumoId: true,
            tipo: true,
            cantidad: true,
            cantidadSecundaria: true,
            ubicacionId: true,
            insumo: { select: { factorConversion: true } },
        },
    })

    const neto = new Map<string, number>()
    const faltantePorUbicacion = new Map<string, number>()
    const faltanteSecundarioPorUbicacion = new Map<string, number>()
    for (const movimiento of movimientos) {
        const signo = movimiento.tipo === 'entrada' ? -1 : 1
        neto.set(movimiento.insumoId, (neto.get(movimiento.insumoId) || 0) + signo * movimiento.cantidad)
        if (!movimiento.ubicacionId) {
            faltantePorUbicacion.set(
                movimiento.insumoId,
                (faltantePorUbicacion.get(movimiento.insumoId) || 0) + signo * movimiento.cantidad,
            )
            const cantidadSecundaria = movimiento.cantidadSecundaria
                ?? (movimiento.insumo.factorConversion && movimiento.insumo.factorConversion > 0
                    ? movimiento.cantidad / movimiento.insumo.factorConversion
                    : 0)
            faltanteSecundarioPorUbicacion.set(
                movimiento.insumoId,
                (faltanteSecundarioPorUbicacion.get(movimiento.insumoId) || 0) + signo * cantidadSecundaria,
            )
        }
    }

    // Compatibilidad con lotes activos creados por la versión anterior: su movimiento
    // afectaba el global pero no el stock de la fábrica.
    for (const [insumoId, cantidad] of faltantePorUbicacion) {
        if (Math.abs(cantidad) <= STOCK_TOLERANCE) continue
        const cantidadSecundaria = faltanteSecundarioPorUbicacion.get(insumoId) || 0
        await tx.stockInsumo.upsert({
            where: { insumoId_ubicacionId: { insumoId, ubicacionId: input.ubicacionId } },
            create: { insumoId, ubicacionId: input.ubicacionId, cantidad: -cantidad, cantidadSecundaria: -cantidadSecundaria },
            update: { cantidad: { decrement: cantidad }, cantidadSecundaria: { decrement: cantidadSecundaria } },
        })
    }
    await tx.movimientoStock.updateMany({
        where: { loteOrigenId: input.loteId, ubicacionId: null },
        data: { ubicacionId: input.ubicacionId },
    })

    const objetivo = new Map(input.consumosObjetivo.map((item) => [item.insumoId, item.cantidad]))
    const insumos = new Set([...neto.keys(), ...objetivo.keys()])
    for (const insumoId of insumos) {
        const diferenciaConsumo = roundStock((objetivo.get(insumoId) || 0) - (neto.get(insumoId) || 0))
        if (Math.abs(diferenciaConsumo) <= STOCK_TOLERANCE) continue
        await aplicarDeltaStockInsumo(tx, {
            insumoId,
            ubicacionId: input.ubicacionId,
            loteId: input.loteId,
            deltaStock: -diferenciaConsumo,
            observaciones: diferenciaConsumo > 0
                ? `Ajuste de consumo al finalizar producción — Lote ${input.loteId}`
                : `Devolución de consumo estimado — Lote ${input.loteId}`,
        })
    }
}
