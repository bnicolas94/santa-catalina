import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/areas — Listar todas las áreas con puestos y empleados
export async function GET() {
    try {
        const areas = await prisma.area.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                responsable: {
                    select: { id: true, nombre: true, apellido: true }
                },
                parent: {
                    select: { id: true, nombre: true }
                },
                children: {
                    select: { id: true, nombre: true, color: true, activo: true }
                },
                puestos: {
                    where: { activo: true },
                    orderBy: { nivelJerarquico: 'desc' },
                    include: {
                        _count: { select: { empleados: true } }
                    }
                },
                _count: {
                    select: { empleados: true }
                }
            }
        })

        return NextResponse.json(areas)
    } catch (error) {
        console.error('Error fetching areas:', error)
        return NextResponse.json({ error: 'Error al obtener áreas' }, { status: 500 })
    }
}

// POST /api/areas — Crear nueva área
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, descripcion, color, responsableId, parentId } = body

        if (!nombre || nombre.trim() === '') {
            return NextResponse.json({ error: 'El nombre del área es requerido' }, { status: 400 })
        }

        // Verificar unicidad del nombre
        const existing = await prisma.area.findUnique({ where: { nombre: nombre.trim() } })
        if (existing) {
            return NextResponse.json({ error: `Ya existe un área con el nombre "${nombre}"` }, { status: 400 })
        }

        // Validar que el parent existe si se proporcionó
        if (parentId) {
            const parentArea = await prisma.area.findUnique({ where: { id: parentId } })
            if (!parentArea) {
                return NextResponse.json({ error: 'El área padre no existe' }, { status: 400 })
            }
        }

        const area = await prisma.area.create({
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                color: color || null,
                responsableId: responsableId || null,
                parentId: parentId || null,
            },
            include: {
                responsable: { select: { id: true, nombre: true, apellido: true } },
                parent: { select: { id: true, nombre: true } },
                puestos: true,
                _count: { select: { empleados: true } }
            }
        })

        return NextResponse.json(area, { status: 201 })
    } catch (error: any) {
        console.error('Error creating area:', error)
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un área con ese nombre' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Error al crear área' }, { status: 500 })
    }
}

// PUT /api/areas — Actualizar área
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { id, nombre, descripcion, color, responsableId, parentId, activo } = body

        if (!id) {
            return NextResponse.json({ error: 'ID de área requerido' }, { status: 400 })
        }

        // Prevenir auto-referencia circular
        if (parentId && parentId === id) {
            return NextResponse.json({ error: 'Un área no puede ser su propio padre' }, { status: 400 })
        }

        const data: any = {}
        if (nombre !== undefined) data.nombre = nombre.trim()
        if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null
        if (color !== undefined) data.color = color || null
        if (responsableId !== undefined) data.responsableId = responsableId || null
        if (parentId !== undefined) data.parentId = parentId || null
        if (activo !== undefined) data.activo = activo

        const area = await prisma.area.update({
            where: { id },
            data,
            include: {
                responsable: { select: { id: true, nombre: true, apellido: true } },
                parent: { select: { id: true, nombre: true } },
                puestos: true,
                _count: { select: { empleados: true } }
            }
        })

        return NextResponse.json(area)
    } catch (error: any) {
        console.error('Error updating area:', error)
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un área con ese nombre' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Error al actualizar área' }, { status: 500 })
    }
}

// DELETE /api/areas — Soft delete (desactivar)
// REGLA: NUNCA se borran datos históricos
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de área requerido' }, { status: 400 })
        }

        // Verificar que no tenga empleados asignados activos
        const empleadosCount = await prisma.empleado.count({
            where: { areaId: id, activo: true }
        })

        if (empleadosCount > 0) {
            return NextResponse.json({
                error: `No se puede desactivar: hay ${empleadosCount} empleado(s) activo(s) asignado(s) a esta área`
            }, { status: 400 })
        }

        await prisma.area.update({
            where: { id },
            data: { activo: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deactivating area:', error)
        return NextResponse.json({ error: 'Error al desactivar área' }, { status: 500 })
    }
}
