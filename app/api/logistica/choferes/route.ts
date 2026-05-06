import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Buscamos empleados con el rol "LOGISTICA"
        // Nota: En la base de datos el nombre del rol es "LOGISTICA" (en mayúsculas)
        const choferes = await prisma.empleado.findMany({
            where: {
                rolRel: {
                    nombre: 'LOGISTICA'
                },
                activo: true
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
