import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarDiario, errorDiario } from '@/lib/diario-errores-api'
import { objeto, texto, validarArea } from '@/lib/diario-errores'

export async function GET() {
    const auth = await autorizarDiario()
    if (auth.rechazo) return auth.rechazo
    try { return NextResponse.json(await prisma.areaError.findMany({ orderBy: { nombre: 'asc' } })) }
    catch (error) { return errorDiario(error) }
}

export async function POST(request: Request) {
    const auth = await autorizarDiario(true)
    if (auth.rechazo) return auth.rechazo
    try { return NextResponse.json(await prisma.areaError.create({ data: validarArea(await request.json()) }), { status: 201 }) }
    catch (error) { return errorDiario(error) }
}

export async function PATCH(request: Request) {
    const auth = await autorizarDiario(true)
    if (auth.rechazo) return auth.rechazo
    try {
        const input = objeto(await request.json())
        return NextResponse.json(await prisma.areaError.update({ where: { id: texto(input.id, 'ID', 100) }, data: validarArea(input) }))
    } catch (error) { return errorDiario(error) }
}
