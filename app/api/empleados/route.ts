import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// GET /api/empleados — Lista todos los empleados
export async function GET() {
    try {
        const empleados = await prisma.empleado.findMany({
            orderBy: { nombre: 'asc' },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                dni: true,
                email: true,
                rol: true,
                telefono: true,
                activo: true,
                createdAt: true,
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
        return NextResponse.json(empleados)
    } catch (error) {
        console.error('Error fetching empleados:', error)
        return NextResponse.json({ error: 'Error al obtener empleados' }, { status: 500 })
    }
}

// POST /api/empleados — Crear nuevo empleado
export async function POST(request: Request) {
    try {
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
            codigoBiometrico
        } = body

        if (!nombre || !rol) {
            return NextResponse.json(
                { error: 'Nombre y rol son requeridos' },
                { status: 400 }
            )
        }

        // Verificar email único si se proporciona
        if (email && email.trim() !== '') {
            const existingEmail = await prisma.empleado.findUnique({ where: { email } })
            if (existingEmail) {
                return NextResponse.json(
                    { error: 'Ya existe un empleado con este email' },
                    { status: 400 }
                )
            }
        }

        if (dni) {
            const existingDni = await prisma.empleado.findUnique({ where: { dni } })
            if (existingDni) {
                return NextResponse.json(
                    { error: 'Ya existe un empleado con este DNI' },
                    { status: 400 }
                )
            }
        }

        if (codigoBiometrico) {
            const existingBiometrico = await prisma.empleado.findUnique({ where: { codigoBiometrico } })
            if (existingBiometrico) {
                return NextResponse.json(
                    { error: 'El código biométrico ya está en uso por otro empleado' },
                    { status: 400 }
                )
            }
        }

        // Password es opcional
        let hashedPassword = null
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10)
        }

        const empleado = await prisma.empleado.create({
            data: {
                nombre,
                apellido,
                dni: (dni && dni.trim() !== '') ? dni : null,
                email: (email && email.trim() !== '') ? email : null,
                password: hashedPassword,
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
            },
        })

        const { password: _, ...empleadoWithoutPassword } = empleado;
        return NextResponse.json(empleadoWithoutPassword, { status: 201 })
    } catch (error) {
        console.error('Error creating empleado:', error)
        return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 })
    }
}
