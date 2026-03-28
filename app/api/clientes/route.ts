import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/services/geocoding'

// GET /api/clientes
export async function GET() {
    try {
        const clientes = await prisma.cliente.findMany({
            orderBy: { nombreComercial: 'asc' },
            include: { _count: { select: { pedidos: true } } },
        })
        return NextResponse.json(clientes)
    } catch (error) {
        console.error('Error fetching clientes:', error)
        return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
    }
}

// POST /api/clientes
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombreComercial, contactoNombre, contactoTelefono, calle, numero, localidad, zona, segmento, frecuenciaSemanal, pedidoPromedioU } = body

        if (!nombreComercial) {
            return NextResponse.json({ error: 'El nombre comercial es requerido' }, { status: 400 })
        }

        // Auto-prefix "Calle " if calle is just a number (e.g. "154", "154a", "154 A", "154 bis")
        let calleFormatted = calle
        if (calleFormatted && /^\d+(\s?[a-zA-Z]+)?$/.test(calleFormatted.trim())) {
            calleFormatted = `Calle ${calleFormatted.trim()}`
        }

        // Compute direccion from components
        const direccion = [calleFormatted, numero, localidad].filter(Boolean).join(', ') || null

        // Auto-geocode if we have at least calle and numero
        let latitud: number | null = null
        let longitud: number | null = null
        const geocode = await geocodeAddress(calleFormatted, numero, localidad)
        if (geocode) {
            latitud = geocode.lat
            longitud = geocode.lng
        }

        const cliente = await prisma.cliente.create({
            data: {
                nombreComercial,
                contactoNombre: contactoNombre || null,
                contactoTelefono: contactoTelefono || null,
                direccion,
                calle: calleFormatted || null,
                numero: numero || null,
                localidad: localidad || null,
                latitud,
                longitud,
                zona: zona || null,
                segmento: segmento || null,
                frecuenciaSemanal: parseInt(frecuenciaSemanal) || 0,
                pedidoPromedioU: parseInt(pedidoPromedioU) || 0,
            },
            include: { _count: { select: { pedidos: true } } },
        })

        return NextResponse.json(cliente, { status: 201 })
    } catch (error) {
        console.error('Error creating cliente:', error)
        return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
    }
}
// DELETE /api/clientes — Borrado masivo por IDs (Incluye limpieza de cascada manual)
export async function DELETE(request: Request) {
    try {
        const body = await request.json()
        const { ids } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Se requiere un array de IDs' }, { status: 400 })
        }

        // Ejecutar borrado en transacción para asegurar consistencia
        // Borramos en orden de dependencias
        await prisma.$transaction(async (tx) => {
            // 1. Movimientos de Caja asociados a pedidos de estos clientes
            await tx.movimientoCaja.deleteMany({
                where: { pedido: { clienteId: { in: ids } } }
            })

            // 2. Entregas de estos clientes
            await tx.entrega.deleteMany({
                where: { clienteId: { in: ids } }
            })

            // 3. Detalles de Pedido de estos clientes
            await tx.detallePedido.deleteMany({
                where: { pedido: { clienteId: { in: ids } } }
            })

            // 4. Pedidos de estos clientes
            await tx.pedido.deleteMany({
                where: { clienteId: { in: ids } }
            })

            // 5. Finalmente, los Clientes
            await tx.cliente.deleteMany({
                where: { id: { in: ids } }
            })
        })

        return NextResponse.json({ success: true, count: ids.length })
    } catch (error) {
        console.error('Error in bulk delete clientes:', error)
        return NextResponse.json({ error: 'Error al eliminar clientes de forma masiva' }, { status: 500 })
    }
}
