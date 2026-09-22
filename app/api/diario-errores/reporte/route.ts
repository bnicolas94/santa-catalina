import { prisma } from '@/lib/prisma'
import { autorizarDiario, errorDiario } from '@/lib/diario-errores-api'
import { DiarioError, diarioCSV, filtrosDiario } from '@/lib/diario-errores'

export async function GET(request: Request) {
    const auth = await autorizarDiario()
    if (auth.rechazo) return auth.rechazo
    try {
        const registros = await prisma.registroError.findMany({ where: filtrosDiario(new URL(request.url).searchParams), include: { area: true }, orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], take: 10001 })
        if (registros.length > 10000) throw new DiarioError('El reporte supera 10.000 registros. Acotá el rango de fechas.')
        return new Response(diarioCSV(registros), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="diario-errores.csv"', 'Cache-Control': 'no-store' } })
    } catch (error) { return errorDiario(error) }
}
