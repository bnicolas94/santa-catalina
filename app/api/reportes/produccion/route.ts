import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const mesParam = searchParams.get('mes')
        const anioParam = searchParams.get('anio')

        const date = new Date()
        const anio = anioParam ? parseInt(anioParam) : date.getFullYear()
        const mes = mesParam ? parseInt(mesParam) : date.getMonth() + 1

        const startOfMonth = new Date(anio, mes - 1, 1)
        const endOfMonth = new Date(anio, mes, 0, 23, 59, 59, 999)

        // 1. Obtener Lotes del mes
        const lotes = await prisma.lote.findMany({
            where: {
                fechaProduccion: { gte: startOfMonth, lte: endOfMonth },
                estado: { not: 'en_produccion' } // Excluir los que aún se están haciendo para reportes consolidados
            },
            include: {
                producto: true
            }
        })

        // 2. Procesar estadísticas
        let statsGlobales = {
            totalPaquetes: 0,
            totalPlanchas: 0,
            totalSanguchitos: 0,
            totalRechazados: 0,
            totalLotes: lotes.length
        }

        const porProducto: Record<string, { 
            nombre: string, 
            codigo: string,
            paquetes: number, 
            planchas: number, 
            sanguchitos: number, 
            rechazados: number 
        }> = {}

        for (const lote of lotes) {
            const planchasPorPaq = lote.producto.planchasPorPaquete || 6
            const planchas = lote.unidadesProducidas * planchasPorPaq
            const sanguchitos = planchas * 8

            statsGlobales.totalPaquetes += lote.unidadesProducidas
            statsGlobales.totalPlanchas += planchas
            statsGlobales.totalSanguchitos += sanguchitos
            statsGlobales.totalRechazados += lote.unidadesRechazadas

            if (!porProducto[lote.producto.id]) {
                porProducto[lote.producto.id] = {
                    nombre: lote.producto.nombre,
                    codigo: lote.producto.codigoInterno,
                    paquetes: 0,
                    planchas: 0,
                    sanguchitos: 0,
                    rechazados: 0
                }
            }

            const p = porProducto[lote.producto.id]
            p.paquetes += lote.unidadesProducidas
            p.planchas += planchas
            p.sanguchitos += sanguchitos
            p.rechazados += lote.unidadesRechazadas
        }

        // 3. Obtener histórico semanal (últimas 4 semanas) para gráfico de tendencia
        // Esto es un extra para que el reporte sea visualmente rico
        const statsSemanales = []
        for (let i = 3; i >= 0; i--) {
            const start = new Date(endOfMonth)
            start.setDate(start.getDate() - (i * 7 + 6))
            const end = new Date(endOfMonth)
            end.setDate(end.getDate() - (i * 7))
            
            // Simplificamos omitiendo horas exactas para el reporte visual
            const res = await prisma.lote.aggregate({
                where: {
                    fechaProduccion: { gte: start, lte: end },
                    estado: { not: 'en_produccion' }
                },
                _sum: { unidadesProducidas: true }
            })
            
            statsSemanales.push({
                semana: `Sem -${i}`,
                paquetes: res._sum.unidadesProducidas || 0
            })
        }

        return NextResponse.json({
            mes,
            anio,
            globales: statsGlobales,
            desglose: Object.values(porProducto).sort((a, b) => b.paquetes - a.paquetes),
            tendencia: statsSemanales
        })

    } catch (error) {
        console.error('Error calculando reporte producción:', error)
        return NextResponse.json({ error: 'Error calculando reporte' }, { status: 500 })
    }
}
