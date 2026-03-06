import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const roles = await prisma.rolEmpleado.findMany({
            orderBy: { nombre: 'asc' }
        })

        // Si no hay roles, podríamos sembrar los básicos
        if (roles.length === 0) {
            const basicRoles = ['ADMIN', 'COORD_PROD', 'OPERARIO', 'LOGISTICA', 'ADMIN_OPS']
            await Promise.all(
                basicRoles.map(rol =>
                    prisma.rolEmpleado.upsert({
                        where: { nombre: rol },
                        update: {},
                        create: { nombre: rol }
                    })
                )
            )
            const updatedRoles = await prisma.rolEmpleado.findMany({ orderBy: { nombre: 'asc' } })
            return NextResponse.json(updatedRoles)
        }

        return NextResponse.json(roles)
    } catch (error) {
        console.error('Error fetching roles:', error)
        return NextResponse.json({ error: 'Error al obtener roles' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { nombre, descripcion, color, permisoDashboard, permisoStock, permisoCaja, permisoPersonal, permisoProduccion, permisoCostos } = body

        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
        }

        const nuevoRol = await prisma.rolEmpleado.create({
            data: {
                nombre,
                descripcion,
                color,
                permisoDashboard: !!permisoDashboard,
                permisoStock: !!permisoStock,
                permisoCaja: !!permisoCaja,
                permisoPersonal: !!permisoPersonal,
                permisoProduccion: !!permisoProduccion,
                permisoCostos: !!permisoCostos
            }
        })

        return NextResponse.json(nuevoRol)
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 })
    }
}
