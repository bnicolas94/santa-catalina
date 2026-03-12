import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/productos
export async function GET() {
    try {
        const productos = await prisma.producto.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                presentaciones: { orderBy: { cantidad: 'desc' } },
                fichasTecnicas: {
                    include: { insumo: true },
                },
            },
        })
        return NextResponse.json(productos)
    } catch (error) {
        console.error('Error fetching productos:', error)
        return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 })
    }
}

// POST /api/productos
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, codigoInterno, vidaUtilHoras, tempConservacionMax, planchasPorPaquete, paquetesPorRonda, presentaciones, alias } = body

        if (!nombre || !codigoInterno) {
            return NextResponse.json({ error: 'Nombre y código interno son requeridos' }, { status: 400 })
        }

        const existing = await prisma.producto.findUnique({ where: { codigoInterno } })
        if (existing) {
            return NextResponse.json({ error: 'Ya existe un producto con este código interno' }, { status: 400 })
        }

        const producto = await prisma.producto.create({
            data: {
                nombre,
                codigoInterno,
                vidaUtilHoras: parseInt(vidaUtilHoras) || 48,
                tempConservacionMax: parseFloat(tempConservacionMax) || 4,
                planchasPorPaquete: parseInt(planchasPorPaquete) || 6,
                planchasPorPaquete: parseInt(paquesPorRonda) || 14,
                alias: alias || null,
                ...(presentaciones?.length && {
                    presentaciones: {
                        create: presentaciones.map((p: { cantidad: string; precioVenta: string }) => ({
                            cantidad: parseInt(p.cantidad),
                            precioVenta: parseFloat(p.precioVenta),
                        })),
                    },
                }),
            },
            include: {
                presentaciones: { orderBy: { cantidad: 'desc' } },
                fichasTecnicas: { include: { insumo: true } },
            },
        })

        return NextResponse.json(producto, { status: 201 })
    } catch (error) {
        console.error('Error creating producto:', error)
        return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
    }
}
