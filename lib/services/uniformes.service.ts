import { Prisma, PrendaUniforme } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fechaClaveRRHH, instanteRRHH } from '@/lib/rrhh/fechas'
import {
    ErrorUniformes, validarDetallesUniforme,
    validarFechaEntrega, validarPrenda, validarTalle, validarTextoOpcional,
} from '@/lib/rrhh/uniformes'

async function transaccionUniformes<T>(operacion: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let intento = 0; intento < 3; intento++) {
        try {
            return await prisma.$transaction(operacion, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && intento < 2) continue
            throw error
        }
    }
    throw new ErrorUniformes('No se pudo completar la operación. Intentá nuevamente.', 409)
}

export async function listarStockUniformes() {
    return prisma.stockUniforme.findMany({
        select: { id: true, prenda: true, talle: true, cantidad: true, tipoModelo: true, marca: true, certificado: true, updatedAt: true },
        orderBy: [{ prenda: 'asc' }, { talle: 'asc' }],
    })
}

export async function listarMovimientosUniformes() {
    return prisma.movimientoUniforme.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true, tipo: true, delta: true, saldoPosterior: true, motivo: true, createdAt: true,
            stock: { select: { prenda: true, talle: true } },
            registradoPor: { select: { nombre: true, apellido: true } },
            entrega: { select: { id: true, empleado: { select: { nombre: true, apellido: true } } } },
        },
    })
}

export async function registrarMovimientoStockUniforme(entrada: unknown, administradorId: string) {
    if (!entrada || typeof entrada !== 'object') throw new ErrorUniformes('Datos inválidos.')
    const dato = entrada as Record<string, unknown>
    const prenda = validarPrenda(dato.prenda)
    const talle = validarTalle(dato.talle)
    const delta = dato.delta
    if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) {
        throw new ErrorUniformes('El movimiento debe ser un entero distinto de cero.')
    }
    const motivo = validarTextoOpcional(dato.motivo, 500)
    if (!motivo) throw new ErrorUniformes('Indicá el motivo del ingreso o ajuste.')

    return transaccionUniformes(async tx => {
        const stock = await tx.stockUniforme.upsert({
            where: { prenda_talle: { prenda, talle } },
            create: { prenda, talle, cantidad: 0 },
            update: {},
        })
        const actualizado = await tx.stockUniforme.updateMany({
            where: { id: stock.id, ...(delta < 0 ? { cantidad: { gte: -delta } } : {}) },
            data: { cantidad: { increment: delta } },
        })
        if (actualizado.count !== 1) throw new ErrorUniformes('No hay stock suficiente.', 409)
        const saldo = await tx.stockUniforme.findUniqueOrThrow({ where: { id: stock.id }, select: { cantidad: true } })
        return tx.movimientoUniforme.create({
            data: {
                stockId: stock.id, registradoPorId: administradorId,
                tipo: delta > 0 ? 'INGRESO' : 'AJUSTE_SALIDA', delta,
                saldoPosterior: saldo.cantidad, motivo,
            },
            select: { id: true, delta: true, saldoPosterior: true },
        })
    })
}

export async function configurarProductoUniforme(stockId: string, entrada: unknown) {
    if (!entrada || typeof entrada !== 'object') throw new ErrorUniformes('Datos inválidos.')
    const dato = entrada as Record<string, unknown>
    const tipoModelo = validarTextoOpcional(dato.tipoModelo, 100)
    const marca = validarTextoOpcional(dato.marca, 100)
    if (!tipoModelo || !marca || typeof dato.certificado !== 'boolean') {
        throw new ErrorUniformes('Completá tipo/modelo, marca y certificación (Sí o No).')
    }
    const stock = await prisma.stockUniforme.findUnique({ where: { id: stockId }, select: { id: true } })
    if (!stock) throw new ErrorUniformes('Prenda y talle no encontrados.', 404)
    return prisma.stockUniforme.update({
        where: { id: stockId }, data: { tipoModelo, marca, certificado: dato.certificado },
        select: { id: true, tipoModelo: true, marca: true, certificado: true },
    })
}

type CrearEntregaInput = {
    empleadoId: string
    fecha: string
    observaciones: string | null
    claveIdempotencia: string
    detalles: { prenda: PrendaUniforme; talle: string; cantidad: number }[]
}

function validarCrearEntrega(entrada: unknown): CrearEntregaInput {
    if (!entrada || typeof entrada !== 'object') throw new ErrorUniformes('Datos inválidos.')
    const dato = entrada as Record<string, unknown>
    if (typeof dato.empleadoId !== 'string' || !dato.empleadoId) throw new ErrorUniformes('Empleado inválido.')
    if (typeof dato.claveIdempotencia !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dato.claveIdempotencia)) {
        throw new ErrorUniformes('Identificador de operación inválido.')
    }
    return {
        empleadoId: dato.empleadoId,
        fecha: validarFechaEntrega(dato.fecha ?? fechaClaveRRHH(new Date())),
        observaciones: validarTextoOpcional(dato.observaciones, 500),
        claveIdempotencia: dato.claveIdempotencia,
        detalles: validarDetallesUniforme(dato.detalles),
    }
}

function verificarReintento(
    existente: Prisma.EntregaUniformeGetPayload<{ include: { detalles: true } }>,
    dato: CrearEntregaInput,
) {
    const iguales = existente.empleadoId === dato.empleadoId
        && fechaClaveRRHH(existente.fecha) === dato.fecha
        && existente.observaciones === dato.observaciones
        && existente.detalles.length === dato.detalles.length
        && dato.detalles.every(item => existente.detalles.some(detalle =>
            detalle.prenda === item.prenda && detalle.talle === item.talle && detalle.cantidad === item.cantidad,
        ))
    if (!iguales) throw new ErrorUniformes('El identificador ya se usó para otra entrega.', 409)
    return existente
}

export async function crearEntregaUniforme(entrada: unknown, administradorId: string) {
    const dato = validarCrearEntrega(entrada)
    const existente = await prisma.entregaUniforme.findUnique({ where: { claveIdempotencia: dato.claveIdempotencia }, include: { detalles: true } })
    if (existente) return verificarReintento(existente, dato)
    try {
        return await transaccionUniformes(async tx => {
            const empleado = await tx.empleado.findUnique({
                where: { id: dato.empleadoId },
                select: { id: true, activo: true, nombre: true, apellido: true, dni: true, rol: true },
            })
            if (!empleado || !empleado.activo) throw new ErrorUniformes('Empleado inexistente o inactivo.', 404)
            const entrega = await tx.entregaUniforme.create({
                data: {
                    empleadoId: dato.empleadoId, fecha: instanteRRHH(dato.fecha, '12:00:00'),
                    observaciones: dato.observaciones, registradoPorId: administradorId,
                    nombreEmpleado: [empleado.nombre, empleado.apellido].filter(Boolean).join(' '),
                    dniEmpleado: empleado.dni, rolEmpleado: empleado.rol,
                    claveIdempotencia: dato.claveIdempotencia,
                    remera: dato.detalles.filter(item => item.prenda === PrendaUniforme.REMERA).reduce((total, item) => total + item.cantidad, 0),
                    buzo: dato.detalles.filter(item => item.prenda === PrendaUniforme.BUZO).reduce((total, item) => total + item.cantidad, 0),
                },
            })
            for (const item of dato.detalles) {
                const stock = await tx.stockUniforme.findUnique({ where: { prenda_talle: { prenda: item.prenda, talle: item.talle } } })
                if (!stock) throw new ErrorUniformes(`No hay stock de ${item.prenda} talle ${item.talle}.`, 409)
                if (!stock.tipoModelo || !stock.marca || stock.certificado === null) {
                    throw new ErrorUniformes(`Configurá modelo, marca y certificación de ${item.prenda} talle ${item.talle} antes de entregarla.`)
                }
                const cambio = await tx.stockUniforme.updateMany({
                    where: { id: stock.id, cantidad: { gte: item.cantidad } },
                    data: { cantidad: { decrement: item.cantidad } },
                })
                if (cambio.count !== 1) throw new ErrorUniformes(`Stock insuficiente de ${item.prenda} talle ${item.talle}.`, 409)
                const saldo = await tx.stockUniforme.findUniqueOrThrow({ where: { id: stock.id }, select: { cantidad: true } })
                await tx.entregaUniformeDetalle.create({
                    data: {
                        entregaId: entrega.id, stockId: stock.id, prenda: item.prenda, talle: item.talle, cantidad: item.cantidad,
                        tipoModelo: stock.tipoModelo, marca: stock.marca, certificado: stock.certificado,
                    },
                })
                await tx.movimientoUniforme.create({
                    data: { stockId: stock.id, entregaId: entrega.id, registradoPorId: administradorId, tipo: 'ENTREGA', delta: -item.cantidad, saldoPosterior: saldo.cantidad },
                })
            }
            return entrega
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const repetida = await prisma.entregaUniforme.findUnique({ where: { claveIdempotencia: dato.claveIdempotencia }, include: { detalles: true } })
            if (repetida) return verificarReintento(repetida, dato)
        }
        throw error
    }
}

export async function anularEntregaUniforme(entregaId: string, motivoEntrada: unknown, administradorId: string) {
    const motivo = validarTextoOpcional(motivoEntrada, 500)
    if (!motivo) throw new ErrorUniformes('Indicá el motivo de anulación.')
    return transaccionUniformes(async tx => {
        const entrega = await tx.entregaUniforme.findUnique({ where: { id: entregaId }, include: { detalles: true } })
        if (!entrega) throw new ErrorUniformes('Entrega no encontrada.', 404)
        if (entrega.estado !== 'ACTIVA') throw new ErrorUniformes('La entrega ya fue anulada.', 409)
        const cambio = await tx.entregaUniforme.updateMany({
            where: { id: entregaId, estado: 'ACTIVA' },
            data: { estado: 'ANULADA', anuladaPorId: administradorId, anuladaAt: new Date(), motivoAnulacion: motivo },
        })
        if (cambio.count !== 1) throw new ErrorUniformes('La entrega ya fue anulada.', 409)
        for (const detalle of entrega.detalles) {
            const stock = await tx.stockUniforme.update({ where: { id: detalle.stockId }, data: { cantidad: { increment: detalle.cantidad } } })
            await tx.movimientoUniforme.create({
                data: {
                    stockId: detalle.stockId, entregaId, registradoPorId: administradorId,
                    tipo: 'ANULACION_ENTREGA', delta: detalle.cantidad,
                    saldoPosterior: stock.cantidad, motivo,
                },
            })
        }
        return { id: entregaId, estado: 'ANULADA' }
    })
}
