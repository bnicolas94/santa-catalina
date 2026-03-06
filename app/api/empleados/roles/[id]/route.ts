import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const body = await req.json()
        const { nombre, descripcion, color, permisoDashboard, permisoStock, permisoCaja, permisoPersonal, permisoProduccion, permisoCostos } = body

        const actualizado = await prisma.rolEmpleado.update({
            where: { id },
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

        return NextResponse.json(actualizado)
    } catch (error) {
        console.error('Error actualizando rol:', error)
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
