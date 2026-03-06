import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/empleados/:id — Actualizar empleado
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
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
            activo
        } = body;

        // Limpiar contraseña si viene vacía para no blanquearla
        const dataToUpdate: any = {
            nombre,
            apellido,
            dni: dni || null,
            email: (email && email.trim() !== '') ? email : null,
            rol,
            telefono: (telefono && telefono.trim() !== '') ? telefono : null,
            fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
            sueldoBaseMensual: sueldoBaseMensual ? parseFloat(sueldoBaseMensual) : 0,
            cicloPago: cicloPago || 'SEMANAL',
            porcentajeHoraExtra: porcentajeHoraExtra ? parseFloat(porcentajeHoraExtra) : 50,
            porcentajeFeriado: porcentajeFeriado ? parseFloat(porcentajeFeriado) : 100,
            horasTrabajoDiarias: horasTrabajoDiarias ? parseFloat(horasTrabajoDiarias) : 8,
            diasTrabajoSemana: diasTrabajoSemana || 'Lunes a Viernes',
            horarioEntrada: horarioEntrada || null,
            horarioSalida: horarioSalida || null,
            codigoBiometrico: codigoBiometrico || null,
        }

        if (activo !== undefined) {
            dataToUpdate.activo = activo;
        }

        if (password && password.trim() !== '') {
            const bcrypt = require('bcryptjs');
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
            },
        })

        return NextResponse.json(empleado)
    } catch (error) {
        console.error('Error updating empleado:', error)
        return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 })
    }
}

// DELETE /api/empleados/:id — Eliminar empleado
export async function DELETE(
    _request: Request,
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
