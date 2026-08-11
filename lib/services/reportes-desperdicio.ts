import { prisma } from '@/lib/prisma'
import { getGlobalConfig } from './reportes'
import { calcularCostoPaqueteReceta, getMermasPeriodo } from './mermas-costos'

/**
 * Servicio de reportes de desperdicio.
 * Analiza: merma en producción, rechazos en entrega, ranking de productos, costo del desperdicio.
 */
export async function getDesperdicioReport(
    desdeIso: string,
    hastaIso: string,
    ubicacionId?: string
) {
    const startOfCurrent = new Date(desdeIso)
    const endOfCurrent = new Date(hastaIso)

    const diffMs = endOfCurrent.getTime() - startOfCurrent.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const endAnterior = new Date(startOfCurrent)
    endAnterior.setDate(endAnterior.getDate() - 1)
    endAnterior.setHours(23, 59, 59, 999)

    const startAnterior = new Date(endAnterior)
    startAnterior.setDate(startAnterior.getDate() - diffDays + 1)
    startAnterior.setHours(0, 0, 0, 0)

    const whereUbi = ubicacionId ? { ubicacionId } : {}

    const [mermasActuales, mermasAnteriores] = await Promise.all([
        getMermasPeriodo(startOfCurrent, endOfCurrent, ubicacionId),
        getMermasPeriodo(startAnterior, endAnterior, ubicacionId)
    ])

    // ── 1. Rechazos en producción (Lotes) ──
    const lotesActual = await prisma.lote.findMany({
        where: {
            fechaProduccion: { gte: startOfCurrent, lte: endOfCurrent },
            estado: { not: 'en_produccion' },
            ...whereUbi
        },
        include: {
            producto: {
                select: {
                    id: true, nombre: true, codigoInterno: true,
                    planchasPorPaquete: true,
                    presentaciones: { select: { id: true, cantidad: true } },
                    fichasTecnicas: { include: { insumo: { select: { precioUnitario: true } } } }
                }
            }
        }
    })

    const lotesAnterior = await prisma.lote.aggregate({
        where: {
            fechaProduccion: { gte: startAnterior, lte: endAnterior },
            estado: { not: 'en_produccion' },
            ...whereUbi
        },
        _sum: { unidadesProducidas: true, unidadesRechazadas: true }
    })

    const sanguchitosPorPlancha = await getGlobalConfig('SANGUCHITOS_POR_PLANCHA', 8)
    const planchasPorPaqDefault = await getGlobalConfig('PLANCHAS_POR_PAQUETE_DEFAULT', 6)

    let totalProducidos = 0
    let totalRechazadosProduccion = 0
    const rechazoPorProducto: Record<string, {
        nombre: string; codigo: string;
        producidos: number; rechazados: number; merma: number;
        costoDesperdicio: number; motivos: string[]
    }> = {}

    for (const lote of lotesActual) {
        totalProducidos += lote.unidadesProducidas
        totalRechazadosProduccion += lote.unidadesRechazadas

        const prodId = lote.producto.id
        if (!rechazoPorProducto[prodId]) {
            rechazoPorProducto[prodId] = {
                nombre: lote.producto.nombre,
                codigo: lote.producto.codigoInterno,
                producidos: 0, rechazados: 0, merma: 0,
                costoDesperdicio: 0, motivos: []
            }
        }

        const entry = rechazoPorProducto[prodId]
        entry.producidos += lote.unidadesProducidas
        entry.rechazados += lote.unidadesRechazadas

        if (lote.unidadesRechazadas > 0) {
            // Calcular costo del desperdicio (paquetes rechazados × planchas × sanguchitos × costo unitario)
            const distribucion = Array.isArray(lote.distribucion)
                ? lote.distribucion as { presentacionId?: string }[]
                : []
            const presentacionId = distribucion[0]?.presentacionId
            const presentacion = lote.producto.presentaciones.find(item => item.id === presentacionId)
            const unidadesPorPaquete = presentacion?.cantidad
                || (lote.producto.planchasPorPaquete || planchasPorPaqDefault) * sanguchitosPorPlancha
            const costoPaquete = calcularCostoPaqueteReceta(
                lote.producto.fichasTecnicas,
                unidadesPorPaquete,
                presentacionId,
            )

            entry.costoDesperdicio += lote.unidadesRechazadas * costoPaquete

            if (lote.motivoRechazo && !entry.motivos.includes(lote.motivoRechazo)) {
                entry.motivos.push(lote.motivoRechazo)
            }
        }
    }

    // Calcular % merma por producto
    for (const key of Object.keys(rechazoPorProducto)) {
        const p = rechazoPorProducto[key]
        p.merma = p.producidos > 0 ? (p.rechazados / p.producidos) * 100 : 0
    }

    const mermaActual = totalProducidos > 0 ? (totalRechazadosProduccion / totalProducidos) * 100 : 0
    const rechazadosAnterior = lotesAnterior._sum.unidadesRechazadas || 0
    const producidosAnterior = lotesAnterior._sum.unidadesProducidas || 0
    const mermaAnterior = producidosAnterior > 0 ? (rechazadosAnterior / producidosAnterior) * 100 : 0

    const costoDesperdicioTotal = mermasActuales.resumen.costoTotal

    // ── 2. Rechazos en entregas ──
    const entregas = await prisma.entrega.findMany({
        where: {
            createdAt: { gte: startOfCurrent, lte: endOfCurrent },
            unidadesRechazadas: { gt: 0 }
        },
        select: {
            unidadesRechazadas: true,
            motivoRechazo: true,
            cliente: { select: { nombreComercial: true } },
            ruta: { select: { fecha: true, zona: true } }
        }
    })

    let totalRechazadosEntrega = 0
    const rechazosEntrega = entregas.map(e => {
        totalRechazadosEntrega += e.unidadesRechazadas
        return {
            cliente: e.cliente.nombreComercial,
            unidades: e.unidadesRechazadas,
            motivo: e.motivoRechazo || 'Sin especificar',
            fecha: e.ruta.fecha,
            zona: e.ruta.zona || '—'
        }
    })

    // ── 3. Tendencia semanal de merma ──
    const tendencia = []
    for (let i = 3; i >= 0; i--) {
        const start = new Date(endOfCurrent)
        start.setDate(start.getDate() - (i * 7 + 6))
        start.setHours(0, 0, 0, 0)
        const end = new Date(endOfCurrent)
        end.setDate(end.getDate() - (i * 7))
        end.setHours(23, 59, 59, 999)

        const lotesSemana = lotesActual.filter(
            l => l.fechaProduccion >= start && l.fechaProduccion <= end
        )

        const prod = lotesSemana.reduce((s, l) => s + l.unidadesProducidas, 0)
        const rech = lotesSemana.reduce((s, l) => s + l.unidadesRechazadas, 0)
        const mermaSem = prod > 0 ? (rech / prod) * 100 : 0

        tendencia.push({
            label: `Sem -${i}`,
            producidos: prod,
            rechazados: rech,
            merma: mermaSem,
            costo: mermasActuales.registros
                .filter(registro => registro.fecha >= start && registro.fecha <= end)
                .reduce((total, registro) => total + registro.costoTotal, 0)
        })
    }

    return {
        desde: desdeIso, hasta: hastaIso,
        kpis: {
            totalRechazadosProduccion,
            totalRechazadosEntrega,
            mermaActual,
            mermaAnterior,
            costoDesperdicioTotal,
            costoDesperdicioAnterior: mermasAnteriores.resumen.costoTotal,
            costoDesperdicioVariacion: mermasAnteriores.resumen.costoTotal > 0
                ? ((costoDesperdicioTotal - mermasAnteriores.resumen.costoTotal) / mermasAnteriores.resumen.costoTotal) * 100
                : null,
            costosEstimados: mermasActuales.resumen.estimados,
            totalProducidos
        },
        rankingProductos: Object.values(rechazoPorProducto)
            .filter(p => p.rechazados > 0)
            .sort((a, b) => b.rechazados - a.rechazados),
        rechazosEntrega,
        tendencia,
        detalleMermas: mermasActuales.registros,
        desgloseOrigen: mermasActuales.resumen.porOrigen,
        desgloseMotivos: mermasActuales.resumen.porMotivo
    }
}
