import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Los choferes se identifican por el permiso del módulo. El nombre
        // histórico se conserva para cuentas que aún no tienen rol vinculado.
        const choferes = await prisma.empleado.findMany({
            where: {
                activo: true,
                OR: [
                    { rolRel: { permisoLogistica: true } },
                    { rol: 'LOGISTICA', rolRel: null },
                ],
            },
            include: {
                documentos: {
                    where: {
                        tipoDocumento: 'LICENCIA_CONDUCIR'
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: [
                { apellido: 'asc' },
                { nombre: 'asc' }
            ]
        })

        return NextResponse.json(choferes)
    } catch (error) {
        console.error('Error fetching choferes:', error)
        return NextResponse.json({ error: 'Error al obtener los choferes' }, { status: 500 })
    }
}
