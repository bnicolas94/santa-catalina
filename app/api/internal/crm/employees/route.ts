import type { ErpEmployeeReference } from '@santa-catalina/contracts'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const ids = [...new Set((request.nextUrl.searchParams.get('ids') || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => value.length > 0 && value.length <= 80))]
    .slice(0, 50)

  if (ids.length === 0) return NextResponse.json([] satisfies ErpEmployeeReference[])

  try {
    const employees = await prisma.empleado.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, apellido: true },
    })
    const response: ErpEmployeeReference[] = employees.map(employee => ({
      id: employee.id,
      name: `${employee.nombre} ${employee.apellido || ''}`.trim(),
    }))
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[CRM internal] No se pudieron resolver los agentes:', error)
    return NextResponse.json({ error: 'No se pudieron consultar los agentes.' }, { status: 500 })
  }
}
