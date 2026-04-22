import { NextResponse } from 'next/server'
import { EmpleadoService, EmpleadoValidationError } from '@/lib/services/empleado.service'

// GET /api/empleados — Lista todos los empleados
export async function GET() {
    try {
        const empleados = await EmpleadoService.findAll()
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
        const empleado = await EmpleadoService.create(body)
        return NextResponse.json(empleado, { status: 201 })
    } catch (error: any) {
        if (error instanceof EmpleadoValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error creating empleado:', error)
        return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 })
    }
}
