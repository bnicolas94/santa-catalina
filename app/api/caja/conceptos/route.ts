import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const DEFAULTS = [
    { clave: 'caja_chica', nombre: '💼 Caja Chica' },
    { clave: 'cobro_pedido', nombre: '📋 Cobro Pedido' },
    { clave: 'pago_proveedor', nombre: '🏪 Pago Proveedor' },
    { clave: 'rendicion_chofer', nombre: '🚛 Rendición Chofer' },
    { clave: 'otro', nombre: '📝 Otro' },
]

async function seedDefaults() {
    const count = await prisma.conceptoCaja.count()
    if (count === 0) {
        await prisma.conceptoCaja.createMany({ data: DEFAULTS })
    }
}

// GET /api/caja/conceptos — Listar conceptos activos
export async function GET() {
    try {
        await seedDefaults()
        const conceptos = await prisma.conceptoCaja.findMany({
            orderBy: { nombre: 'asc' },
        })
        return NextResponse.json(conceptos)
    } catch (error) {
        console.error('Error obteniendo conceptos:', error)
        return NextResponse.json({ error: 'Error al cargar conceptos' }, { status: 500 })
    }
}

// POST /api/caja/conceptos — Crear concepto
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre } = body
        if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

        // Generar clave a partir del nombre
        const clave = nombre.replace(/[^\w\s]/g, '').trim().toLowerCase().replace(/\s+/g, '_')

        const concepto = await prisma.conceptoCaja.create({
            data: { clave, nombre },
        })
        return NextResponse.json(concepto, { status: 201 })
    } catch (error) {
        console.error('Error creando concepto:', error)
        return NextResponse.json({ error: 'Error al crear concepto' }, { status: 500 })
    }
}

// PUT /api/caja/conceptos — Editar concepto
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { id, nombre, activo } = body
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        const data: { nombre?: string; activo?: boolean } = {}
        if (nombre !== undefined) data.nombre = nombre
        if (activo !== undefined) data.activo = activo

        const concepto = await prisma.conceptoCaja.update({
            where: { id },
            data,
        })
        return NextResponse.json(concepto)
    } catch (error) {
        console.error('Error editando concepto:', error)
        return NextResponse.json({ error: 'Error al editar concepto' }, { status: 500 })
    }
}

// DELETE /api/caja/conceptos — Eliminar concepto
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        await prisma.conceptoCaja.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error eliminando concepto:', error)
        return NextResponse.json({ error: 'Error al eliminar concepto' }, { status: 500 })
    }
}
