import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseOrderText, PresentacionData } from '@/lib/parsers/orderText'

// Normaliza la fecha desde Excel (pueden ser números de serie o strings)
function normalizarFecha(raw: any, fallbackStr: string): Date {
    if (!raw) return new Date(fallbackStr + 'T00:00:00Z')
    
    // Caso: Número de serie de Excel (e.g. 45371)
    if (typeof raw === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30))
        const d = new Date(excelEpoch.getTime() + raw * 24 * 60 * 60 * 1000)
        d.setUTCHours(0, 0, 0, 0)
        return d
    }

    // Caso: String (e.g. "26/03/2024" o "2024-03-26" o "27-mar")
    if (typeof raw === 'string') {
        const parts = raw.split(/[-/]/)
        if (parts.length === 3) {
            let d: Date | null = null
            if (parseInt(parts[0]) <= 31) {
                const day = parseInt(parts[0])
                const month = parseInt(parts[1]) - 1
                const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2])
                d = new Date(Date.UTC(year, month, day))
            } else if (parseInt(parts[0]) > 1000) {
                const year = parseInt(parts[0])
                const month = parseInt(parts[1]) - 1
                const day = parseInt(parts[2])
                d = new Date(Date.UTC(year, month, day))
            }
            if (d && !isNaN(d.getTime())) return d
        }
        
        // Manejo específico para "DD-MMM" (ej: "27-mar")
        if (parts.length === 2) {
            const day = parseInt(parts[0])
            const monthStr = parts[1].toLowerCase()
            const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
            const month = months.findIndex(m => monthStr.startsWith(m))
            if (day > 0 && day <= 31 && month !== -1) {
                const year = new Date().getFullYear()
                return new Date(Date.UTC(year, month, day))
            }
        }

        const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00Z')
        if (!isNaN(d.getTime())) return d
    }

    return new Date(fallbackStr + 'T00:00:00Z')
}

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
// Body: { fecha: 'YYYY-MM-DD', filas: [{ fechaRaw?: any, turno: string, texto: string }] }
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !(session.user as any)?.rol) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { fecha: fechaDefault, filas, confirmar } = await req.json()

        if (!fechaDefault || !Array.isArray(filas)) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
        }

        // Traer presentaciones para el parser
        const presentacionesDB = await prisma.presentacion.findMany({
            where: { activo: true },
            select: {
                id: true,
                cantidad: true,
                productoId: true,
                producto: {
                    select: {
                        id: true,
                        codigoInterno: true,
                        alias: true,
                        planchasPorPaquete: true,
                    }
                }
            }
        })

        // Procesar cada fila
        interface FilaResultado {
            filaIndex: number
            fechaValue?: Date
            turnoRaw: string
            turnoNorm: string | null
            texto: string
            status: 'ok' | 'sin_turno' | 'sin_match' | 'parcial'
            destino: 'FABRICA' | 'LOCAL'
            items: Array<{ productoId: string, presentacionId: string, productoNombre: string, cantidadPaquetes: number, tokenOriginal: string }>
            errores: string[]
        }
        const resultados: FilaResultado[] = []

        for (let i = 0; i < filas.length; i++) {
            const { fechaRaw, turno: turnoRaw, texto, destino: destinoRaw } = filas[i]
            const fechaNorm = normalizarFecha(fechaRaw, fechaDefault)
            const turnoNorm = normalizarTurno(turnoRaw || '')
            const destino = String(destinoRaw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('retir') ? 'LOCAL' : 'FABRICA'
            const errores: string[] = []

            if (!turnoNorm) {
                errores.push(`Turno no reconocido: "${turnoRaw}". Use Mañana, Siesta o Tarde.`)
                resultados.push({ filaIndex: i, fechaValue: fechaNorm, turnoRaw, turnoNorm, texto, status: 'sin_turno', destino, items: [], errores })
                continue
            }

            if (!texto?.trim()) {
                errores.push('Texto de necesidades vacío.')
                resultados.push({ filaIndex: i, fechaValue: fechaNorm, turnoRaw, turnoNorm, texto, status: 'sin_match', destino, items: [], errores })
                continue
            }

            const parsed = parseOrderText(texto, presentacionesDB as PresentacionData[])

            // Convertir detalles de pedido (presentacionId + cantidad paquetes) → agrupado por productoId + presentacionId
            const agrupado: Record<string, { 
                productoId: string, 
                presentacionId: string, 
                productoNombreBase: string, 
                paquetesMatch: number, 
                totalUnidades: number, 
                tokenOriginal: string 
            }> = {}

            for (const det of parsed.detalles) {
                const pres = presentacionesDB.find(p => p.id === det.presentacionId)
                if (!pres) continue
                const pid = (pres.producto as any).id
                const key = `${pid}_${det.presentacionId}`
                
                if (!agrupado[key]) {
                    agrupado[key] = {
                        productoId: pid,
                        presentacionId: det.presentacionId,
                        productoNombreBase: `${(pres.producto as any).codigoInterno} [x${pres.cantidad}]`,
                        paquetesMatch: 0,
                        totalUnidades: 0,
                        tokenOriginal: texto
                    }
                }
                agrupado[key].paquetesMatch += det.cantidad
                agrupado[key].totalUnidades += det.cantidad * pres.cantidad
            }

            resultados.push({
                filaIndex: i,
                fechaValue: fechaNorm,
                turnoRaw,
                turnoNorm,
                texto,
                status: !parsed.isFullyMatched ? 'parcial' : 'ok',
                destino,
                items: Object.values(agrupado).map(item => ({
                    productoId: item.productoId,
                    presentacionId: item.presentacionId,
                    productoNombre: `${item.productoNombreBase} x${item.paquetesMatch}`,
                    cantidadPaquetes: item.totalUnidades,
                    tokenOriginal: item.tokenOriginal
                })),
                errores: (parsed.unmatchedText || !parsed.isFullyMatched) ? ["No se pudo armar el pedido completo con paquetes disponibles."] : []
            })
        }

        // Calcular total de planchas de Elegidos (ELE) para el preview
        let totalPlanchasElegidos = 0
        resultados.forEach(r => {
            r.items.forEach(item => {
                const pres = presentacionesDB.find(p => p.id === item.presentacionId)
                if (pres?.producto.codigoInterno === 'ELE') {
                    const plPorPaq = pres.producto.planchasPorPaquete || 6
                    const uniPorPlancha = 48 / plPorPaq
                    totalPlanchasElegidos += (item.cantidadPaquetes / uniPorPlancha)
                }
            })
        })

        // Si es solo preview, devolvemos resultados sin guardar
        if (!confirmar) {
            return NextResponse.json({ 
                preview: true, 
                resultados,
                ok: resultados.filter(r => r.status === 'ok').length,
                parcial: resultados.filter(r => r.status === 'parcial').length,
                error: resultados.filter(r => r.status === 'sin_turno' || r.status === 'sin_match').length,
                totalPlanchasElegidos: Math.round(totalPlanchasElegidos * 10) / 10
            })
        }

        // Si es confirmación, guardamos en DB
        // BORRÓN Y CUENTA NUEVA: Identificamos todos los pares (fecha, turno) que están en el Excel
        const gruposABorrar = new Map<string, { fecha: Date, turnos: Set<string> }>()
        
        resultados.forEach(r => {
            if (r.turnoNorm && r.fechaValue) {
                const fStr = r.fechaValue.toISOString().split('T')[0]
                if (!gruposABorrar.has(fStr)) {
                    gruposABorrar.set(fStr, { fecha: r.fechaValue, turnos: new Set() })
                }
                gruposABorrar.get(fStr)!.turnos.add(r.turnoNorm)
            }
        })
        
        for (const [fStr, data] of gruposABorrar) {
            // PREVENCIÓN: No permitir borrar ni sobreescribir si el turno ya fue descontado
            const turnosArray = Array.from(data.turnos)
            // @ts-ignore
            const yaDescontados = await prisma.planificacionDescuento.findMany({
                where: {
                    fecha: data.fecha,
                    turno: { in: turnosArray }
                }
            })

            if (yaDescontados.length > 0) {
                const nombres = yaDescontados.map(d => d.turno).join(', ')
                return NextResponse.json({ 
                    error: `No se puede importar: Los turnos (${nombres}) del día ${fStr} ya han sido procesados y su stock descontado.` 
                }, { status: 400 })
            }

            await prisma.requerimientoProduccion.deleteMany({
                where: {
                    fecha: data.fecha,
                    turno: { in: turnosArray }
                }
            })
        }

        let guardados = 0
        for (const resultado of resultados) {
            if (!resultado.turnoNorm) continue
            const fechaFila = resultado.fechaValue || new Date(fechaDefault + 'T00:00:00Z')
            const shipmentId = crypto.randomUUID()

            if (resultado.items.length === 0) {
                // Fila "rara" o no identificada: Guardamos solo para el contador
                await prisma.requerimientoProduccion.create({
                    data: {
                        fecha: fechaFila,
                        turno: resultado.turnoNorm!,
                        productoId: null,
                        presentacionId: null,
                        cantidad: 0,
                        destino: resultado.destino,
                        shipmentId,
                        textoOriginal: resultado.texto
                    }
                })
                guardados++
            } else {
                for (const item of resultado.items) {
                    await prisma.requerimientoProduccion.create({
                        data: {
                            fecha: fechaFila,
                            turno: resultado.turnoNorm!,
                            productoId: item.productoId,
                            presentacionId: item.presentacionId,
                            cantidad: item.cantidadPaquetes,
                            destino: resultado.destino,
                            shipmentId,
                            textoOriginal: resultado.texto
                        }
                    })
                    guardados++
                }
            }
        }
        return NextResponse.json({ success: true, guardados, resultados })

    } catch (error: any) {
        console.error('Error en importación de planificación:', error)
        return NextResponse.json({ error: 'Error interno', details: error.message }, { status: 500 })
    }
}
