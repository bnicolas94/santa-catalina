import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { autorizarDiario, errorDiario } from '@/lib/diario-errores-api'
import { DiarioError, filtrosDiario, objeto, texto, validarRegistro } from '@/lib/diario-errores'

export async function GET(request: Request) {
    const auth = await autorizarDiario()
    if (auth.rechazo) return auth.rechazo
    try {
        const params = new URL(request.url).searchParams
        const page = Number(params.get('pagina') || 1)
        if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new DiarioError('Página inválida')
        const where = filtrosDiario(params)
        const [registros, total] = await prisma.$transaction([
            prisma.registroError.findMany({ where, include: { area: true }, orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20 }),
            prisma.registroError.count({ where }),
        ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
        return NextResponse.json({ registros, total, pagina: page })
    } catch (error) { return errorDiario(error) }
}

async function guardar(request: Request, editar: boolean) {
    const auth = await autorizarDiario()
    if (auth.rechazo) return auth.rechazo
    try {
        const input = objeto(await request.json())
        const data = validarRegistro(input)
        const registro = await prisma.$transaction(async tx => {
            const actual = editar ? await tx.registroError.findUniqueOrThrow({ where: { id: texto(input.id, 'ID', 100) } }) : null
            if (actual && auth.user.rol !== 'ADMIN' && actual.creadoPorId !== auth.user.id) return null
            if (actual && texto(input.updatedAt, 'Versión', 40) !== actual.updatedAt.toISOString()) throw new DiarioError('Este registro fue modificado. Actualizá el diario antes de editarlo.')
            const area = await tx.areaError.findUnique({ where: { id: data.areaId } })
            if (!area || (!area.activa && actual?.areaId !== area.id)) throw new DiarioError('Seleccioná un área activa')
            return actual
                ? tx.registroError.update({ where: { id: actual.id }, data, include: { area: true } })
                : tx.registroError.create({ data: { ...data, creadoPorId: auth.user.id!, creadoPorNombre: auth.user.name || 'Usuario' }, include: { area: true } })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        if (!registro) return NextResponse.json({ error: 'Sólo podés editar tus propios registros' }, { status: 403 })
        return NextResponse.json(registro, { status: editar ? 200 : 201 })
    } catch (error) { return errorDiario(error) }
}

export async function POST(request: Request) { return guardar(request, false) }
export async function PATCH(request: Request) { return guardar(request, true) }
