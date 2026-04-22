import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/turnos — Listar todos los turnos
export async function GET() {
    try {
        const turnos = await prisma.turnoTrabajo.findMany({
            where: { activo: true },
            orderBy: { horaInicio: 'asc' },
            include: {
                _count: { select: { empleados: true } }
            }
        })
        return NextResponse.json(turnos)
    } catch (error) {
        console.error('Error fetching turnos:', error)
        return NextResponse.json({ error: 'Error al obtener turnos' }, { status: 500 })
    }
}

// POST /api/turnos — Crear nuevo turno
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, descripcion, horaInicio, horaFin, toleranciaMinutos } = body

        if (!nombre || !horaInicio || !horaFin) {
            return NextResponse.json({ error: 'Nombre, hora de inicio y hora de fin son requeridos' }, { status: 400 })
        }

        const existing = await prisma.turnoTrabajo.findUnique({ where: { nombre: nombre.trim() } })
        if (existing) {
            return NextResponse.json({ error: 'Ya existe un turno con ese nombre' }, { status: 400 })
        }

        const turno = await prisma.turnoTrabajo.create({
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                horaInicio,
                horaFin,
                toleranciaMinutos: toleranciaMinutos !== undefined ? parseInt(toleranciaMinutos) : 15
            },
            include: {
                _count: { select: { empleados: true } }
            }
        })

        return NextResponse.json(turno, { status: 201 })
    } catch (error: any) {
        console.error('Error creating turno:', error)
        return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
    }
}

// PUT /api/turnos — Actualizar turno
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { id, nombre, descripcion, horaInicio, horaFin, toleranciaMinutos, activo } = body

        if (!id) {
            return NextResponse.json({ error: 'ID de turno requerido' }, { status: 400 })
        }

        const data: any = {}
        if (nombre !== undefined) data.nombre = nombre.trim()
        if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null
        if (horaInicio !== undefined) data.horaInicio = horaInicio
        if (horaFin !== undefined) data.horaFin = horaFin
        if (toleranciaMinutos !== undefined) data.toleranciaMinutos = parseInt(toleranciaMinutos)
        if (activo !== undefined) data.activo = activo

        const turno = await prisma.turnoTrabajo.update({
            where: { id },
            data,
            include: {
                _count: { select: { empleados: true } }
            }
        })

        return NextResponse.json(turno)
    } catch (error: any) {
        console.error('Error updating turno:', error)
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un turno con ese nombre' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Error al actualizar turno' }, { status: 500 })
    }
}

// DELETE /api/turnos — Soft delete
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de turno requerido' }, { status: 400 })
        }

        const empleadosCount = await prisma.empleado.count({
            where: { turnoId: id, activo: true }
        })

        if (empleadosCount > 0) {
            return NextResponse.json({
                error: `No se puede desactivar: hay ${empleadosCount} empleado(s) activo(s) con este turno`
            }, { status: 400 })
        }

        await prisma.turnoTrabajo.update({
            where: { id },
            data: { activo: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deactivating turno:', error)
        return NextResponse.json({ error: 'Error al desactivar turno' }, { status: 500 })
    }
}
