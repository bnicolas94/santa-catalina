import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fechaLocalArgentina } from '@/lib/stock-sucursales'
import { autorizarOrdenCompra } from '@/lib/compras/ordenes-api'
import { leerOrdenCompraInput } from '@/lib/compras/ordenes'

export async function GET(request: Request) {
    const acceso = await autorizarOrdenCompra()
    if (acceso.rechazo) return acceso.rechazo
    try {
        const params = new URL(request.url).searchParams
        const pagina = Number(params.get('pagina') || 1)
        if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000) return NextResponse.json({ error: 'Página inválida' }, { status: 400 })
        const proveedorId = params.get('proveedorId') || undefined
        const where: Prisma.OrdenCompraWhereInput = proveedorId ? { proveedorId } : {}
        const [ordenes, total] = await prisma.$transaction([
            prisma.ordenCompra.findMany({ where, orderBy: { numero: 'desc' }, skip: (pagina - 1) * 20, take: 20, include: { detalles: { orderBy: { posicion: 'asc' } } } }),
            prisma.ordenCompra.count({ where }),
        ])
        return NextResponse.json({ ordenes, total, pagina })
    } catch (error) {
        console.error('Error listando órdenes:', error)
        return NextResponse.json({ error: 'No se pudieron cargar las órdenes' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const acceso = await autorizarOrdenCompra()
    if (acceso.rechazo) return acceso.rechazo
    try {
        const input = leerOrdenCompraInput(await request.json())
        const orden = await prisma.$transaction(async (tx) => {
            const [proveedor, ubicacion, insumos] = await Promise.all([
                tx.proveedor.findFirst({ where: { id: input.proveedorId, activo: true }, select: { id: true, nombre: true, contacto: true, telefono: true } }),
                input.ubicacionId ? tx.ubicacion.findFirst({ where: { id: input.ubicacionId, activo: true }, select: { id: true, nombre: true } }) : Promise.resolve(null),
                tx.insumo.findMany({ where: { id: { in: input.detalles.map((item) => item.insumoId) }, activo: true }, select: { id: true, nombre: true, unidadMedida: true } }),
            ])
            if (!proveedor) throw new Error('Seleccioná un proveedor activo')
            if (input.ubicacionId && !ubicacion) throw new Error('Seleccioná una sede activa')
            if (insumos.length !== input.detalles.length) throw new Error('Uno o más insumos ya no están activos')
            const porId = new Map(insumos.map((item) => [item.id, item]))
            return tx.ordenCompra.create({ data: {
                fechaLocal: fechaLocalArgentina(),
                proveedorId: proveedor.id,
                proveedorNombre: proveedor.nombre,
                proveedorContacto: proveedor.contacto,
                proveedorTelefono: proveedor.telefono,
                ubicacionId: ubicacion?.id || null,
                ubicacionNombre: ubicacion?.nombre || null,
                observaciones: input.observaciones,
                creadoPorNombre: acceso.user?.name || 'Usuario',
                detalles: { create: input.detalles.map((item, posicion) => ({
                    insumoId: item.insumoId,
                    insumoNombre: porId.get(item.insumoId)!.nombre,
                    unidadMedida: porId.get(item.insumoId)!.unidadMedida,
                    cantidad: item.cantidad,
                    observaciones: item.observaciones,
                    posicion,
                })) },
            }, include: { detalles: { orderBy: { posicion: 'asc' } } } })
        })
        return NextResponse.json(orden, { status: 201 })
    } catch (error) {
        if (error instanceof SyntaxError || error instanceof Error && /^(Datos|Seleccioná|La orden|Renglón|Cada insumo|Un insumo|Uno o más)/.test(error.message)) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error creando orden:', error)
        return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 })
    }
}
