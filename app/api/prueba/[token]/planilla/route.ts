import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DURACION_MINUTOS } from '@/lib/postulaciones/prueba'
import { hashToken, tokenValido } from '@/lib/postulaciones/token'
import { crearPlanilla, leerPlanilla } from '@/lib/postulaciones/planilla'

type Context = { params: Promise<{ token: string }> }
const headers = { 'Cache-Control': 'no-store, private' }

async function buscar(context: Context) {
    const { token } = await context.params
    return tokenValido(token) ? prisma.pruebaPostulante.findUnique({ where: { tokenHash: hashToken(token) } }) : null
}

function disponible(prueba: NonNullable<Awaited<ReturnType<typeof buscar>>>) {
    return prueba.version === 3 && !!prueba.inicioAt && !prueba.entregaAt && !prueba.anuladaAt && Date.now() < prueba.inicioAt.getTime() + DURACION_MINUTOS * 60_000
}

export async function GET(_request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba || !disponible(prueba)) return NextResponse.json({ error: 'La planilla no está disponible' }, { status: 404, headers })
    const archivo = crearPlanilla()
    return new NextResponse(new Uint8Array(archivo), { headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="prueba-planilla.xlsx"' } })
}

export async function PUT(request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba || !disponible(prueba)) return NextResponse.json({ error: 'La prueba ya no admite archivos' }, { status: 409, headers })
    if (!request.body) return NextResponse.json({ error: 'Seleccioná un archivo .xlsx' }, { status: 400, headers })
    let planilla
    try {
        const lector = request.body.getReader()
        const partes: Buffer[] = []
        let longitud = 0
        while (true) {
            const { done, value } = await lector.read()
            if (done) break
            longitud += value.byteLength
            if (longitud > 1_000_000) { await lector.cancel(); throw new Error('El archivo supera 1 MB') }
            partes.push(Buffer.from(value))
        }
        const bytes = Buffer.concat(partes)
        if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Subí un archivo .xlsx válido')
        const nombre = new URL(request.url).searchParams.get('nombre') || 'planilla.xlsx'
        if (!nombre.toLowerCase().endsWith('.xlsx')) throw new Error('Subí un archivo .xlsx')
        planilla = leerPlanilla(bytes, nombre)
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo leer el archivo' }, { status: 400, headers })
    }
    try {
        const result = await prisma.pruebaPostulante.updateMany({
            where: { id: prueba.id, version: 3, inicioAt: { not: null, gt: new Date(Date.now() - DURACION_MINUTOS * 60_000) }, entregaAt: null, anuladaAt: null },
            data: { planilla },
        })
        if (!result.count) return NextResponse.json({ error: 'La prueba ya no admite archivos' }, { status: 409, headers })
        return NextResponse.json({ ok: true, nombreArchivo: planilla.nombreArchivo, origenIntacto: planilla.origenIntacto }, { headers })
    } catch (error) {
        console.error('No se pudo guardar la planilla de la prueba:', error)
        return NextResponse.json({ error: 'No se pudo guardar la planilla. Intentá nuevamente.' }, { status: 500, headers })
    }
}
