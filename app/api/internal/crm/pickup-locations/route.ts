import type { ErpPickupLocation } from '@santa-catalina/contracts'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const locations = await prisma.ubicacion.findMany({
      where: { activo: true, tipo: 'LOCAL' },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    })

    const response: ErpPickupLocation[] = locations.map(location => ({
      id: location.id,
      name: location.nombre,
    }))
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[CRM internal] No se pudieron obtener los locales de retiro:', error)
    return NextResponse.json({ error: 'No se pudieron consultar los locales de retiro.' }, { status: 500 })
  }
}
