import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/proveedores
export async function GET() {
    try {
        const proveedores = await prisma.proveedor.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                _count: { select: { insumos: true } },
            },
        })
        return NextResponse.json(proveedores)
    } catch (error) {
        console.error('Error fetching proveedores:', error)
        return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 })
    }
}

// POST /api/proveedores
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, contacto, telefono, email, direccion } = body

        if (!nombre) {
            return NextResponse.json(
                { error: 'El nombre del proveedor es requerido' },
                { status: 400 }
            )
        }

        const proveedor = await prisma.proveedor.create({
            data: {
                nombre,
                contacto: contacto || null,
                telefono: telefono || null,
                email: email || null,
                direccion: direccion || null,
            },
        })

        return NextResponse.json(proveedor, { status: 201 })
    } catch (error) {
        console.error('Error creating proveedor:', error)
        return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 })
    }
}
