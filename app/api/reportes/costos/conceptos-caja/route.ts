import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGlobalConfig, updateGlobalConfig } from '@/lib/services/reportes'

const CONFIG_KEY = 'conceptos_caja_en_costos'

/**
 * GET: Lista todos los ConceptoCaja activos e indica cuáles están tildados para costos.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user as any).rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        // Obtener todos los conceptos de caja activos
        const conceptos = await prisma.conceptoCaja.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        })

        // Obtener los conceptos tildados desde ConfiguracionGlobal
        const tildadosRaw = await getGlobalConfig(CONFIG_KEY, '[]')
        let tildados: string[] = []
        try {
            tildados = JSON.parse(tildadosRaw as string)
        } catch {
            tildados = []
        }

        // Marcar cuáles están tildados
        const result = conceptos.map(c => ({
            id: c.id,
            clave: c.clave,
            nombre: c.nombre,
            tildado: tildados.includes(c.clave)
        }))

        return NextResponse.json({ conceptos: result, tildados })
    } catch (error) {
        console.error('Error fetching conceptos caja para costos:', error)
        return NextResponse.json({ error: 'Error al obtener conceptos' }, { status: 500 })
    }
}

/**
 * POST: Guarda el array de claves de conceptos tildados.
 * Body: { tildados: ["obra_villa_elisa", "uniformes"] }
 */
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user as any).rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { tildados } = await request.json()
        if (!Array.isArray(tildados)) {
            return NextResponse.json({ error: 'tildados debe ser un array de strings' }, { status: 400 })
        }

        await updateGlobalConfig(CONFIG_KEY, tildados)

        return NextResponse.json({ success: true, tildados })
    } catch (error) {
        console.error('Error updating conceptos caja para costos:', error)
        return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
    }
}
