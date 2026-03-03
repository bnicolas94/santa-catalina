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
                email: true,
                rol: true,
                telefono: true,
                activo: true,
                createdAt: true,
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
        const { nombre, email, password, rol, telefono } = body

        if (!nombre || !email || !password || !rol) {
            return NextResponse.json(
                { error: 'Nombre, email, contraseña y rol son requeridos' },
                { status: 400 }
            )
        }

        // Verificar email único
        const existing = await prisma.empleado.findUnique({ where: { email } })
        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe un empleado con este email' },
                { status: 400 }
            )
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const empleado = await prisma.empleado.create({
            data: {
                nombre,
                email,
                password: hashedPassword,
                rol,
                telefono: telefono || null,
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                telefono: true,
                activo: true,
            },
        })

        return NextResponse.json(empleado, { status: 201 })
    } catch (error) {
        console.error('Error creating empleado:', error)
        return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 })
    }
}
