import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

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
            valorHoraExtra,
            porcentajeFeriado,
            horasTrabajoDiarias,
            diasTrabajoSemana,
            horarioEntrada,
            horarioSalida,
            jornal,
            codigoBiometrico,
            ubicacionId,
            rolId,
            activo
        } = body;

        // Robustecimiento de Fecha de Ingreso
        let validatedFechaIngreso = undefined; // Usar undefined para no sobreescribir si no viene nada
        if (fechaIngreso) {
            const dateObj = new Date(fechaIngreso);
            if (!isNaN(dateObj.getTime())) {
                validatedFechaIngreso = dateObj;
            } else if (fechaIngreso === '') {
                validatedFechaIngreso = null;
            }
        }

        const dataToUpdate: any = {
            nombre: nombre || undefined,
            apellido: (apellido !== undefined) ? apellido : undefined,
            dni: (dni !== undefined) ? (dni || null) : undefined,
            email: (email !== undefined) ? (email || null) : undefined,
            rol: rol || undefined,
            telefono: (telefono !== undefined) ? (telefono || null) : undefined,
            fechaIngreso: validatedFechaIngreso,
            sueldoBaseMensual: !isNaN(parseFloat(sueldoBaseMensual)) ? parseFloat(sueldoBaseMensual) : undefined,
            cicloPago: cicloPago || undefined,
            porcentajeHoraExtra: !isNaN(parseFloat(porcentajeHoraExtra)) ? parseFloat(porcentajeHoraExtra) : undefined,
            valorHoraExtra: !isNaN(parseFloat(valorHoraExtra)) ? parseFloat(valorHoraExtra) : undefined,
            porcentajeFeriado: !isNaN(parseFloat(porcentajeFeriado)) ? parseFloat(porcentajeFeriado) : undefined,
            horasTrabajoDiarias: !isNaN(parseFloat(horasTrabajoDiarias)) ? parseFloat(horasTrabajoDiarias) : undefined,
            diasTrabajoSemana: diasTrabajoSemana || undefined,
            horarioEntrada: (horarioEntrada !== undefined) ? (horarioEntrada || null) : undefined,
            horarioSalida: (horarioSalida !== undefined) ? (horarioSalida || null) : undefined,
            jornal: !isNaN(parseFloat(jornal)) ? parseFloat(jornal) : undefined,
            codigoBiometrico: (codigoBiometrico !== undefined) ? (codigoBiometrico || null) : undefined,
            ubicacionId: (ubicacionId !== undefined) ? (ubicacionId || null) : undefined,
            rolId: (rolId !== undefined) ? (rolId || null) : undefined,
        }

        if (activo !== undefined) {
            dataToUpdate.activo = activo;
        }

        if (password && password.trim() !== '') {
            const bcrypt = require('bcryptjs');
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }

        console.log(`[EMPLEADOS API] Data a enviar a Prisma para ${id}:`, dataToUpdate);

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
                valorHoraExtra: true,
                porcentajeFeriado: true,
                horasTrabajoDiarias: true,
                diasTrabajoSemana: true,
                horarioEntrada: true,
                horarioSalida: true,
                jornal: true,
                codigoBiometrico: true,
                ubicacionId: true,
                ubicacion: { select: { id: true, nombre: true, tipo: true } },
            },
        })

        return NextResponse.json(empleado)
    } catch (error: any) {
        console.error(`[EMPLEADOS API] ERROR CRITICO actualizando empleado ${employeeId}:`, error);
        // Intentar dar detalles específicos de PrismaP2002 (Unique constraint)
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
