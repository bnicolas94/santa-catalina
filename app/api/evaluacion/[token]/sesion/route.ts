import { NextResponse } from 'next/server'
import { sesionPublica } from '@/lib/evaluacion-candidatos/sesion.server'
type Context = { params: Promise<{ token: string }> }
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
export async function POST(request: Request, context: Context) {
    try {
        const texto = await request.text()
        if (texto.length > 110000) return NextResponse.json({ error: 'Respuesta demasiado grande' }, { status: 413, headers })
        const input = JSON.parse(texto)
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Datos inválidos')
        return NextResponse.json(await sesionPublica((await context.params).token, input), { headers })
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo guardar' }, { status: 409, headers }) }
}
