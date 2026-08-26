import { NextRequest, NextResponse } from 'next/server'
import { EmpleadoService, EmpleadoValidationError } from '@/lib/services/empleado.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PUT /api/empleados/:id — Actualizar empleado
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let employeeId = 'desconocido';
    try {
        const { id } = await params
        employeeId = id;
        const body = await request.json()
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        
        console.log(`[EMPLEADOS API] Intentando actualizar empleado ${id}:`, {
            ...body,
            password: body.password ? '****' : undefined
        });

        const empleado = await EmpleadoService.update(id, body, usuario.id)
        return NextResponse.json(empleado)
    } catch (error: any) {
        console.error(`[EMPLEADOS API] ERROR CRITICO actualizando empleado ${employeeId}:`, error);
        if (error instanceof EmpleadoValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        // Detalles específicos de PrismaP2002 (Unique constraint)
        if (error?.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'campo';
            return NextResponse.json({ 
                error: `Ya existe un empleado con ese ${field}`,
                details: error.message
            }, { status: 400 });
        }
        return NextResponse.json({ 
            error: 'Error interno al actualizar empleado',
            details: error?.message || String(error)
        }, { status: 500 })
    }
}

// DELETE /api/empleados/:id — Soft delete de empleado
// REGLA: NUNCA se borran datos históricos. Se desactiva el registro.
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await EmpleadoService.softDelete(id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deactivating empleado:', error)
        return NextResponse.json({ error: 'Error al desactivar empleado' }, { status: 500 })
    }
}
