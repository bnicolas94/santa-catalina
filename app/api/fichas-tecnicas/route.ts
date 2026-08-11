import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const TIPOS_CONSUMO = ['por_unidad', 'por_paquete'] as const

function mensajeError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return 'Ese insumo ya está configurado para el mismo alcance'
    }
    return error instanceof Error ? error.message : 'No se pudo guardar la ficha técnica'
}

async function datosFicha(body: Record<string, unknown>) {
    const productoId = String(body.productoId || '')
    const insumoId = String(body.insumoId || '')
    const tipoConsumo = String(body.tipoConsumo || 'por_unidad')
    const presentacionId = body.presentacionId ? String(body.presentacionId) : null
    const cantidadNetaPaquete = Number(body.cantidadNetaPaquete)
    const unidadesReferencia = Number(body.unidadesReferencia)
    const merma = Number(body.merma || 0)

    if (!productoId || !insumoId) throw new Error('Producto e insumo son obligatorios')
    if (!TIPOS_CONSUMO.includes(tipoConsumo as typeof TIPOS_CONSUMO[number])) {
        throw new Error('El tipo de consumo no es válido')
    }
    if (!Number.isFinite(cantidadNetaPaquete) || cantidadNetaPaquete <= 0) {
        throw new Error('La cantidad debe ser mayor a cero')
    }
    if (!Number.isFinite(merma) || merma < 0 || merma >= 100) {
        throw new Error('La merma debe estar entre 0 y 99,99%')
    }
    if (tipoConsumo === 'por_unidad' && (!Number.isInteger(unidadesReferencia) || unidadesReferencia <= 0)) {
        throw new Error('La presentación de referencia no es válida')
    }

    const [producto, insumo, presentacion] = await Promise.all([
        prisma.producto.findUnique({ where: { id: productoId }, select: { id: true } }),
        prisma.insumo.findUnique({ where: { id: insumoId }, select: { id: true, unidadMedida: true } }),
        presentacionId
            ? prisma.presentacion.findFirst({ where: { id: presentacionId, productoId }, select: { id: true } })
            : Promise.resolve(null),
    ])
    if (!producto) throw new Error('El producto no existe')
    if (!insumo) throw new Error('El insumo no existe')
    if (presentacionId && !presentacion) throw new Error('La presentación no pertenece al producto')

    const cantidadPorUnidad = tipoConsumo === 'por_unidad'
        ? cantidadNetaPaquete / unidadesReferencia
        : cantidadNetaPaquete
    const claveAlcance = `${presentacionId || 'global'}:${tipoConsumo}`

    return {
        productoId,
        insumoId,
        cantidadPorUnidad,
        unidadMedida: insumo.unidadMedida,
        merma,
        tipoConsumo,
        presentacionId,
        claveAlcance,
    }
}

export async function GET(request: Request) {
    try {
        const productoId = new URL(request.url).searchParams.get('productoId')
        const fichas = await prisma.fichaTecnica.findMany({
            where: productoId ? { productoId } : {},
            include: { insumo: true, producto: true, presentacion: true },
            orderBy: [{ presentacionId: 'asc' }, { insumo: { nombre: 'asc' } }],
        })
        return NextResponse.json(fichas)
    } catch (error) {
        console.error('Error fetching fichas:', error)
        return NextResponse.json({ error: 'Error al obtener fichas técnicas' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const data = await datosFicha(await request.json())
        const ficha = await prisma.fichaTecnica.create({
            data,
            include: { insumo: true, presentacion: true },
        })
        return NextResponse.json(ficha, { status: 201 })
    } catch (error) {
        console.error('Error creating ficha:', error)
        return NextResponse.json({ error: mensajeError(error) }, { status: 400 })
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const id = String(body.id || '')
        if (!id) throw new Error('ID requerido')
        const data = await datosFicha(body)
        const ficha = await prisma.fichaTecnica.update({
            where: { id },
            data,
            include: { insumo: true, presentacion: true },
        })
        return NextResponse.json(ficha)
    } catch (error) {
        console.error('Error updating ficha:', error)
        return NextResponse.json({ error: mensajeError(error) }, { status: 400 })
    }
}

export async function DELETE(request: Request) {
    try {
        const id = new URL(request.url).searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
        await prisma.fichaTecnica.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting ficha:', error)
        return NextResponse.json({ error: 'Error al eliminar ficha técnica' }, { status: 500 })
    }
}
