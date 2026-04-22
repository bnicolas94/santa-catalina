import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/evaluaciones — Listar evaluaciones
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')

        const evaluaciones = await prisma.evaluacion.findMany({
            where: empleadoId ? { empleadoId } : {},
            include: {
                evaluador: { select: { nombre: true, apellido: true } },
                empleado: { select: { nombre: true, apellido: true } }
            },
            orderBy: { fecha: 'desc' }
        })
        return NextResponse.json(evaluaciones)
    } catch (error) {
        console.error('Error fetching evaluaciones:', error)
        return NextResponse.json({ error: 'Error al obtener evaluaciones' }, { status: 500 })
    }
}

// POST /api/evaluaciones — Crear nueva evaluación
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        // El evaluador es el usuario logueado (asumiendo que tiene un empleado asociado)
        // Buscamos al empleado por el email de la sesión
        const evaluador = await prisma.empleado.findUnique({
            where: { email: session.user?.email || '' }
        })

        if (!evaluador) return NextResponse.json({ error: 'Evaluador no encontrado' }, { status: 403 })

        const body = await request.json()
        const { empleadoId, calificacion, puntosFuertes, puntosMejora, comentarios, fecha } = body

        if (!empleadoId || !calificacion) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
        }

        const evaluacion = await prisma.evaluacion.create({
            data: {
                empleadoId,
                evaluadorId: evaluador.id,
                calificacion,
                puntosFuertes,
                puntosMejora,
                comentarios,
                fecha: fecha ? new Date(fecha) : new Date()
            },
            include: {
                evaluador: { select: { nombre: true, apellido: true } }
            }
        })

        return NextResponse.json(evaluacion)
    } catch (error: any) {
        console.error('Error creating evaluacion:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
