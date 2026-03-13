import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

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
        
        console.log(`[EMPLEADOS API] Intentando actualizar empleado ${id}:`, {
            ...body,
            password: body.password ? '****' : undefined
        });

        const {
            nombre,
            apellido,
            dni,
            email,
            password,
            rol,
            telefono,
            fechaIngreso,
            sueldoBaseMensual,
            cicloPago,
            porcentajeHoraExtra,
            porcentajeFeriado,
            horasTrabajoDiarias,
            diasTrabajoSemana,
            horarioEntrada,
            horarioSalida,
            codigoBiometrico,
            ubicacionId,
            activo
        } = body;

        // Robustecimiento de Fecha de Ingreso
        let validatedFechaIngreso = null;
        if (fechaIngreso) {
            const dateObj = new Date(fechaIngreso);
            if (!isNaN(dateObj.getTime())) {
                validatedFechaIngreso = dateObj;
            } else {
                console.warn(`[EMPLEADOS API] Fecha de ingreso inválida recibida: ${fechaIngreso}`);
            }
        }

        const dataToUpdate: any = {
            nombre: nombre || undefined,
            apellido: apellido || undefined,
            dni: dni || null,
            email: (email && email.trim() !== '') ? email : null,
            rol: rol || undefined,
            telefono: (telefono && telefono.trim() !== '') ? telefono : null,
            fechaIngreso: validatedFechaIngreso,
            sueldoBaseMensual: !isNaN(parseFloat(sueldoBaseMensual)) ? parseFloat(sueldoBaseMensual) : undefined,
            cicloPago: cicloPago || undefined,
            porcentajeHoraExtra: !isNaN(parseFloat(porcentajeHoraExtra)) ? parseFloat(porcentajeHoraExtra) : undefined,
            porcentajeFeriado: !isNaN(parseFloat(porcentajeFeriado)) ? parseFloat(porcentajeFeriado) : undefined,
            horasTrabajoDiarias: !isNaN(parseFloat(horasTrabajoDiarias)) ? parseFloat(horasTrabajoDiarias) : undefined,
            diasTrabajoSemana: diasTrabajoSemana || undefined,
            horarioEntrada: horarioEntrada || null,
            horarioSalida: horarioSalida || null,
            codigoBiometrico: codigoBiometrico || null,
            ubicacionId: ubicacionId || null,
        }

        if (activo !== undefined) {
            dataToUpdate.activo = activo;
        }

        if (password && password.trim() !== '') {
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }

        const empleado = await prisma.empleado.update({
            where: { id },
            data: dataToUpdate,
            select: {
                id: true,
                nombre: true,
                apellido: true,
                dni: true,
                email: true,
                rol: true,
                telefono: true,
                activo: true,
                fechaIngreso: true,
                sueldoBaseMensual: true,
                cicloPago: true,
                porcentajeHoraExtra: true,
                porcentajeFeriado: true,
                horasTrabajoDiarias: true,
                diasTrabajoSemana: true,
                horarioEntrada: true,
                horarioSalida: true,
                codigoBiometrico: true,
                ubicacionId: true,
                ubicacion: { select: { id: true, nombre: true, tipo: true } },
            },
        })

        return NextResponse.json(empleado)
    } catch (error: any) {
        console.error(`[EMPLEADOS API] Error actualizando empleado ${employeeId}:`, error)
        return NextResponse.json({ 
            error: 'Error al actualizar empleado',
            details: error?.message || String(error)
        }, { status: 500 })
    }
}

// DELETE /api/empleados/:id — Eliminar empleado
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.empleado.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting empleado:', error)
        return NextResponse.json({ error: 'Error al eliminar empleado' }, { status: 500 })
    }
}
