import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// POST /api/presentaciones — Create presentation for a product
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { productoId, cantidad, precioVenta } = body

        if (!productoId || !cantidad || precioVenta === undefined) {
            return NextResponse.json({ error: 'Producto, cantidad y precio son requeridos' }, { status: 400 })
        }

        const presentacion = await prisma.presentacion.create({
            data: {
                productoId,
                cantidad: parseInt(cantidad),
                precioVenta: parseFloat(precioVenta),
            },
            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } },
        })

        return NextResponse.json(presentacion, { status: 201 })
    } catch (error) {
        console.error('Error creating presentacion:', error)
        return NextResponse.json({ error: 'Error al crear presentación. Puede que ya exista esa cantidad para este producto.' }, { status: 500 })
    }
}
