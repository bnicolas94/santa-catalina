import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizarRolEmpleado, RolEmpleadoValidationError } from '@/lib/empleados/roles'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cambioSalarialRelevante, configuracionSalarialEfectiva } from '@/lib/rrhh/historialSalarial'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (usuario.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo un administrador puede modificar tipos de empleado.' }, { status: 403 })

        const { id } = await context.params
        const data = normalizarRolEmpleado(await req.json())

        const actualizado = await prisma.$transaction(async tx => {
            const anterior = await tx.rolEmpleado.findUniqueOrThrow({
                where: { id },
                include: {
                    empleados: {
                        select: {
                            id: true,
                            jornal: true,
                            sueldoBaseMensual: true,
                            cicloPago: true,
                            valorHoraExtra: true,
                        },
                    },
                },
            })
            const rolActualizado = await tx.rolEmpleado.update({ where: { id }, data })
            // `Empleado.rol` se conserva por compatibilidad con accesos históricos.
            // Al renombrar el tipo, ambos vínculos deben seguir diciendo lo mismo.
            await tx.empleado.updateMany({ where: { rolId: id }, data: { rol: data.nombre } })

            const cambios = anterior.empleados.flatMap(empleado => {
                const configuracionAnterior = configuracionSalarialEfectiva({ ...empleado, rolRel: anterior })
                const configuracionNueva = configuracionSalarialEfectiva({ ...empleado, rolRel: rolActualizado })
                if (!cambioSalarialRelevante(configuracionAnterior, configuracionNueva)) return []
                return [{
                    origen: 'ROL',
                    empleadoId: empleado.id,
                    rolId: id,
                    registradoPorId: usuario.id,
                    montoAnterior: configuracionAnterior.monto,
                    montoNuevo: configuracionNueva.monto,
                    cicloPagoAnterior: configuracionAnterior.cicloPago,
                    cicloPagoNuevo: configuracionNueva.cicloPago,
                    valorHoraExtraAnterior: configuracionAnterior.valorHoraExtra,
                    valorHoraExtraNuevo: configuracionNueva.valorHoraExtra,
                    fuenteAnterior: configuracionAnterior.fuente,
                    fuenteNueva: configuracionNueva.fuente,
                }]
            })
            if (cambios.length > 0) await tx.historialSalarial.createMany({ data: cambios })

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
