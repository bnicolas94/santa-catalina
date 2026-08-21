import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizarRolEmpleado, RolEmpleadoValidationError } from '@/lib/empleados/roles'

export async function GET() {
    try {
        const roles = await prisma.rolEmpleado.findMany({
            orderBy: { nombre: 'asc' },
            include: { _count: { select: { empleados: true } } },
        })

        // Si no hay roles, podríamos sembrar los básicos
        if (roles.length === 0) {
            const basicRoles = [
                { nombre: 'ADMIN' },
                { nombre: 'COORD_PROD', permisoDashboard: true, permisoStock: true, permisoCompras: true, permisoProduccion: true },
                { nombre: 'OPERARIO', permisoProduccion: true },
                { nombre: 'LOGISTICA', permisoLogistica: true, permisoFlota: true },
                { nombre: 'ADMIN_OPS', permisoDashboard: true, permisoStock: true, permisoCompras: true, permisoClientes: true, permisoPedidos: true },
            ]
            await Promise.all(
                basicRoles.map(rol =>
                    prisma.rolEmpleado.upsert({
                        where: { nombre: rol.nombre },
                        update: {},
                        create: rol,
                    })
                )
            )
            const updatedRoles = await prisma.rolEmpleado.findMany({
                orderBy: { nombre: 'asc' },
                include: { _count: { select: { empleados: true } } },
            })
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
        const data = normalizarRolEmpleado(await req.json())

        const nuevoRol = await prisma.rolEmpleado.create({
            data,
            include: { _count: { select: { empleados: true } } },
        })

        return NextResponse.json(nuevoRol)
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 })
        }
        if (error instanceof RolEmpleadoValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
        console.error('Error creating role:', error)
        return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 })
    }
}
