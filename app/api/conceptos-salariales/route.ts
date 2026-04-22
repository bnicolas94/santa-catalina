import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/conceptos-salariales — Listar todos los conceptos
export async function GET() {
    try {
        const conceptos = await prisma.conceptoSalarial.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        })
        return NextResponse.json(conceptos)
    } catch (error) {
        console.error('Error fetching conceptos:', error)
        return NextResponse.json({ error: 'Error al obtener conceptos' }, { status: 500 })
    }
}

// POST /api/conceptos-salariales — Crear nuevo concepto
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, tipo, esPorcentaje, valorPorDefecto } = body

        if (!nombre || !tipo) {
            return NextResponse.json({ error: 'Nombre y tipo son requeridos' }, { status: 400 })
        }

        const existing = await prisma.conceptoSalarial.findUnique({ where: { nombre: nombre.trim() } })
        if (existing) {
            return NextResponse.json({ error: 'Ya existe un concepto salarial con ese nombre' }, { status: 400 })
        }

        const concepto = await prisma.conceptoSalarial.create({
            data: {
                nombre: nombre.trim(),
                tipo,
                esPorcentaje: !!esPorcentaje,
                valorPorDefecto: valorPorDefecto !== undefined ? parseFloat(valorPorDefecto) : null
            }
        })

        return NextResponse.json(concepto, { status: 201 })
    } catch (error: any) {
        console.error('Error creating concepto:', error)
        return NextResponse.json({ error: 'Error al crear concepto' }, { status: 500 })
    }
}

// PUT /api/conceptos-salariales — Actualizar concepto
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { id, nombre, tipo, esPorcentaje, valorPorDefecto, activo } = body

        if (!id) {
            return NextResponse.json({ error: 'ID de concepto requerido' }, { status: 400 })
        }

        const data: any = {}
        if (nombre !== undefined) data.nombre = nombre.trim()
        if (tipo !== undefined) data.tipo = tipo
        if (esPorcentaje !== undefined) data.esPorcentaje = !!esPorcentaje
        if (valorPorDefecto !== undefined) data.valorPorDefecto = valorPorDefecto !== null ? parseFloat(valorPorDefecto) : null
        if (activo !== undefined) data.activo = activo

        const concepto = await prisma.conceptoSalarial.update({
            where: { id },
            data
        })

        return NextResponse.json(concepto)
    } catch (error: any) {
        console.error('Error updating concepto:', error)
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un concepto con ese nombre' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Error al actualizar concepto' }, { status: 500 })
    }
}

// DELETE /api/conceptos-salariales — Soft delete
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de concepto requerido' }, { status: 400 })
        }

        // Si ya hay ItemsLiquidacion referenciando a este concepto, solo lo marcamos inactivo
        await prisma.conceptoSalarial.update({
            where: { id },
            data: { activo: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deactivating concepto:', error)
        return NextResponse.json({ error: 'Error al desactivar concepto' }, { status: 500 })
    }
}
