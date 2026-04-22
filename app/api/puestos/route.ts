import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/puestos — Listar puestos (opcionalmente filtrado por área)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const areaId = searchParams.get('areaId')

        const where: any = { activo: true }
        if (areaId) {
            where.areaId = areaId
        }

        const puestos = await prisma.puesto.findMany({
            where,
            orderBy: [{ nivelJerarquico: 'desc' }, { nombre: 'asc' }],
            include: {
                area: { select: { id: true, nombre: true, color: true } },
                _count: { select: { empleados: true } }
            }
        })

        return NextResponse.json(puestos)
    } catch (error) {
        console.error('Error fetching puestos:', error)
        return NextResponse.json({ error: 'Error al obtener puestos' }, { status: 500 })
    }
}

// POST /api/puestos — Crear nuevo puesto
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, descripcion, nivelJerarquico, areaId } = body

        if (!nombre || nombre.trim() === '') {
            return NextResponse.json({ error: 'El nombre del puesto es requerido' }, { status: 400 })
        }

        if (!areaId) {
            return NextResponse.json({ error: 'El área es requerida' }, { status: 400 })
        }

        // Verificar que el área existe
        const area = await prisma.area.findUnique({ where: { id: areaId } })
        if (!area) {
            return NextResponse.json({ error: 'El área no existe' }, { status: 400 })
        }

        const puesto = await prisma.puesto.create({
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                nivelJerarquico: nivelJerarquico || 0,
                areaId,
            },
            include: {
                area: { select: { id: true, nombre: true, color: true } },
                _count: { select: { empleados: true } }
            }
        })

        return NextResponse.json(puesto, { status: 201 })
    } catch (error) {
        console.error('Error creating puesto:', error)
        return NextResponse.json({ error: 'Error al crear puesto' }, { status: 500 })
    }
}

// PUT /api/puestos — Actualizar puesto
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { id, nombre, descripcion, nivelJerarquico, areaId, activo } = body

        if (!id) {
            return NextResponse.json({ error: 'ID de puesto requerido' }, { status: 400 })
        }

        const data: any = {}
        if (nombre !== undefined) data.nombre = nombre.trim()
        if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null
        if (nivelJerarquico !== undefined) data.nivelJerarquico = nivelJerarquico
        if (areaId !== undefined) data.areaId = areaId
        if (activo !== undefined) data.activo = activo

        const puesto = await prisma.puesto.update({
            where: { id },
            data,
            include: {
                area: { select: { id: true, nombre: true, color: true } },
                _count: { select: { empleados: true } }
            }
        })

        return NextResponse.json(puesto)
    } catch (error) {
        console.error('Error updating puesto:', error)
        return NextResponse.json({ error: 'Error al actualizar puesto' }, { status: 500 })
    }
}

// DELETE /api/puestos — Soft delete
// REGLA: NUNCA se borran datos históricos
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de puesto requerido' }, { status: 400 })
        }

        // Verificar que no tenga empleados activos
        const empleadosCount = await prisma.empleado.count({
            where: { puestoId: id, activo: true }
        })

        if (empleadosCount > 0) {
            return NextResponse.json({
                error: `No se puede desactivar: hay ${empleadosCount} empleado(s) activo(s) con este puesto`
            }, { status: 400 })
        }

        await prisma.puesto.update({
            where: { id },
            data: { activo: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deactivating puesto:', error)
        return NextResponse.json({ error: 'Error al desactivar puesto' }, { status: 500 })
    }
}
