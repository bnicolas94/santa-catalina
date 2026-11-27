import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarOrdenCompra } from '@/lib/compras/ordenes-api'

export async function GET() {
    const acceso = await autorizarOrdenCompra()
    if (acceso.rechazo) return acceso.rechazo
    try {
        const [proveedores, insumos, ubicaciones] = await Promise.all([
            prisma.proveedor.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
            prisma.insumo.findMany({ where: { activo: true }, select: { id: true, nombre: true, unidadMedida: true, proveedorId: true, proveedores: { select: { proveedorId: true } } }, orderBy: { nombre: 'asc' } }),
            prisma.ubicacion.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
        ])
        return NextResponse.json({ proveedores, insumos, ubicaciones })
    } catch (error) {
        console.error('Error obteniendo catálogo de órdenes:', error)
        return NextResponse.json({ error: 'No se pudo cargar el catálogo' }, { status: 500 })
    }
}
