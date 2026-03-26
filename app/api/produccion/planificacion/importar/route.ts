import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseOrderText, PresentacionData } from '@/lib/parsers/orderText'

// Normaliza el texto del turno al nombre canónico
function normalizarTurno(raw: string): string | null {
    const clean = raw.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    if (clean.includes('man') || clean === 'm') return 'Mañana'
    if (clean.includes('sies') || clean === 's') return 'Siesta'
    if (clean.includes('tard') || clean === 't') return 'Tarde'
    return null
}

// POST /api/produccion/planificacion/importar
// Body: { fecha: 'YYYY-MM-DD', filas: [{ turno: string, texto: string }] }
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !(session.user as any)?.rol) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { fecha, filas, confirmar } = await req.json()

        if (!fecha || !Array.isArray(filas)) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
        }

        const startOfDay = new Date(fecha)
        startOfDay.setUTCHours(0, 0, 0, 0)

        // Traer presentaciones para el parser
        const presentacionesDB = await prisma.presentacion.findMany({
            where: { activo: true },
            select: {
                id: true,
                cantidad: true,
                producto: {
                    select: {
                        id: true,
                        codigoInterno: true,
                        alias: true,
                    }
                }
            }
        })

        // Procesar cada fila
        interface FilaResultado {
            filaIndex: number
            turnoRaw: string
            turnoNorm: string | null
            texto: string
            status: 'ok' | 'sin_turno' | 'sin_match' | 'parcial'
            items: Array<{ productoId: string, presentacionId: string, productoNombre: string, cantidadPaquetes: number, tokenOriginal: string }>
            errores: string[]
        }
        const resultados: FilaResultado[] = []

        for (let i = 0; i < filas.length; i++) {
            const { turno: turnoRaw, texto } = filas[i]
            const turnoNorm = normalizarTurno(turnoRaw || '')
            const errores: string[] = []

            if (!turnoNorm) {
                errores.push(`Turno no reconocido: "${turnoRaw}". Use Mañana, Siesta o Tarde.`)
                resultados.push({ filaIndex: i, turnoRaw, turnoNorm, texto, status: 'sin_turno', items: [], errores })
                continue
            }

            if (!texto?.trim()) {
                errores.push('Texto de necesidades vacío.')
                resultados.push({ filaIndex: i, turnoRaw, turnoNorm, texto, status: 'sin_match', items: [], errores })
                continue
            }

            const parsed = parseOrderText(texto, presentacionesDB as PresentacionData[])

            // Convertir detalles de pedido (presentacionId + cantidad paquetes) → agrupado por productoId + presentacionId
            const agrupado: Record<string, { productoId: string, presentacionId: string, productoNombre: string, cantidadPaquetes: number, tokenOriginal: string }> = {}

            for (const det of parsed.detalles) {
                const pres = presentacionesDB.find(p => p.id === det.presentacionId)
                if (!pres) continue
                const pid = (pres.producto as any).id
                const key = `${pid}_${det.presentacionId}`
                
                if (!agrupado[key]) {
                    agrupado[key] = {
                        productoId: pid,
                        presentacionId: det.presentacionId,
                        productoNombre: `${(pres.producto as any).codigoInterno} [x${pres.cantidad}]`,
                        cantidadPaquetes: 0,
                        tokenOriginal: texto
                    }
                }
                // det.cantidad es el número de paquetes matcheados (ej: 2 si 96jyq matchea 2x48)
                // Guardamos la cantidad en UNIDADES (sándwiches) para el registro en DB
                agrupado[key].cantidadPaquetes += det.cantidad * pres.cantidad
            }

            resultados.push({
                filaIndex: i,
                turnoRaw,
                turnoNorm,
                texto,
                status: !parsed.isFullyMatched ? 'parcial' : 'ok',
                items: Object.values(agrupado),
                errores: parsed.unmatchedText ? [`Tokens no reconocidos: "${parsed.unmatchedText}"`] : []
            })
        }

        // Si es solo preview, devolvemos resultados sin guardar
        if (!confirmar) {
            return NextResponse.json({ 
                preview: true, 
                resultados,
                ok: resultados.filter(r => r.status === 'ok').length,
                parcial: resultados.filter(r => r.status === 'parcial').length,
                error: resultados.filter(r => r.status === 'sin_turno' || r.status === 'sin_match').length,
            })
        }

        // Si es confirmación, guardamos en DB
        // BORRÓN Y CUENTA NUEVA: Identificamos todos los turnos que están en el Excel
        const turnosAImportar = Array.from(new Set(resultados.filter(r => r.turnoNorm).map(r => r.turnoNorm!)))
        
        if (turnosAImportar.length > 0) {
            // Eliminamos los requerimientos existentes para esos turnos en esa fecha
            await prisma.requerimientoProduccion.deleteMany({
                where: {
                    fecha: startOfDay,
                    turno: { in: turnosAImportar }
                }
            })
        }

        let guardados = 0
        // itemsAInsertar is no longer needed as we are using create inside the loop
        // const itemsAInsertar: any[] = []

        for (const resultado of resultados) {
            if (!resultado.turnoNorm || resultado.items.length === 0) continue

            for (const item of resultado.items) {
                await prisma.requerimientoProduccion.create({
                    data: {
                        fecha: startOfDay,
                        turno: resultado.turnoNorm!,
                        productoId: item.productoId,
                        presentacionId: item.presentacionId,
                        cantidad: item.cantidadPaquetes
                    }
                })
                guardados++
            }
        }
        return NextResponse.json({ success: true, guardados, resultados })

    } catch (error: any) {
        console.error('Error en importación de planificación:', error)
        return NextResponse.json({ error: 'Error interno', details: error.message }, { status: 500 })
    }
}
