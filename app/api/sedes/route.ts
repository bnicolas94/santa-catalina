import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validarSede, validarCambioTipo, SedeValidationError } from '@/lib/sedes'

async function autorizar() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
    if ((session.user as { rol?: string } | undefined)?.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede administrar sedes' }, { status: 403 })
}

function responderError(error: unknown) {
    if (error instanceof SedeValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Ya existe una sede con ese nombre' }, { status: 409 })
        if (error.code === 'P2025') return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ error: 'No se pudo guardar o consultar la sede' }, { status: 500 })
}

export async function GET() {
    const rechazo = await autorizar()
    if (rechazo) return rechazo
    try {
        return NextResponse.json(await prisma.ubicacion.findMany({ orderBy: { nombre: 'asc' } }))
    } catch (error) { return responderError(error) }
}

export async function POST(request: Request) {
    const rechazo = await autorizar()
    if (rechazo) return rechazo
    try {
        const data = validarSede(await request.json())
        return NextResponse.json(await prisma.ubicacion.create({ data }), { status: 201 })
    } catch (error) { return responderError(error) }
}

export async function PATCH(request: Request) {
    const rechazo = await autorizar()
    if (rechazo) return rechazo
    try {
        const input = await request.json()
        const data = validarSede(input)
        if (typeof input.id !== 'string' || !input.id.trim()) throw new SedeValidationError('ID requerido')
        const sede = await prisma.$transaction(async tx => {
            const actual = await tx.ubicacion.findUniqueOrThrow({ where: { id: input.id }, include: { _count: true } })
            validarCambioTipo(actual.tipo, data.tipo, actual._count)
            return tx.ubicacion.update({ where: { id: input.id }, data })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        return NextResponse.json(sede)
    } catch (error) { return responderError(error) }
}

// Compatibilidad con clientes anteriores: una baja conserva todas las relaciones.
export async function DELETE(request: Request) {
    const rechazo = await autorizar()
    if (rechazo) return rechazo
    try {
        const id = new URL(request.url).searchParams.get('id')
        if (!id) throw new SedeValidationError('ID requerido')
        await prisma.ubicacion.update({ where: { id }, data: { activo: false } })
        return NextResponse.json({ ok: true })
    } catch (error) { return responderError(error) }
}
