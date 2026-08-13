import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizarRolEmpleado, RolEmpleadoValidationError } from '@/lib/empleados/roles'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const data = normalizarRolEmpleado(await req.json())

        const actualizado = await prisma.$transaction(async tx => {
            await tx.rolEmpleado.update({ where: { id }, data })
            // `Empleado.rol` se conserva por compatibilidad con accesos históricos.
            // Al renombrar el tipo, ambos vínculos deben seguir diciendo lo mismo.
            await tx.empleado.updateMany({ where: { rolId: id }, data: { rol: data.nombre } })
            return tx.rolEmpleado.findUniqueOrThrow({
                where: { id },
                include: { _count: { select: { empleados: true } } },
            })
        })

        return NextResponse.json(actualizado)
    } catch (error: unknown) {
        console.error('Error actualizando rol:', error)
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un tipo de empleado con ese nombre.' }, { status: 400 })
        }
        if (error instanceof RolEmpleadoValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 })
    }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params

        // Verificar si hay empleados con este rol
        const empleadosCount = await prisma.empleado.count({
            where: { rolId: id }
        })

        if (empleadosCount > 0) {
            return NextResponse.json({
                error: `No se puede eliminar el rol porque tiene ${empleadosCount} empleados asignados.`
            }, { status: 400 })
        }

        await prisma.rolEmpleado.delete({ where: { id } })
        return NextResponse.json({ message: 'Rol eliminado' })
    } catch (error) {
        console.error('Error eliminando rol:', error)
        return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 })
    }
}
