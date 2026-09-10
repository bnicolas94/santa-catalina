import type { ErpProductCatalogItem } from '@santa-catalina/contracts'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.producto.findMany({
      where: { activo: true, presentaciones: { some: { activo: true } } },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        codigoInterno: true,
        variantes: {
          where: { activo: true },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
          select: { id: true, codigo: true, nombre: true },
        },
        presentaciones: {
          where: { activo: true },
          orderBy: { cantidad: 'desc' },
          select: { id: true, cantidad: true, precioVenta: true },
        },
      },
    })

    const response: ErpProductCatalogItem[] = products.map(product => ({
      id: product.id,
      name: product.nombre,
      code: product.codigoInterno,
      variants: product.variantes.map(variant => ({
        id: variant.id,
        code: variant.codigo,
        name: variant.nombre,
      })),
      presentations: product.presentaciones.map(presentation => ({
        id: presentation.id,
        unitsPerPackage: presentation.cantidad,
        basePrice: presentation.precioVenta,
      })),
    }))
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[CRM internal] No se pudo obtener el catálogo:', error)
    return NextResponse.json({ error: 'No se pudo consultar el catálogo comercial.' }, { status: 500 })
  }
}
