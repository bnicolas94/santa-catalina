import { prisma } from '@/lib/prisma'

/**
 * Servicio de reportes de performance operativa.
 * Analiza: producción por coordinador, cumplimiento de entregas, eficiencia logística.
 */
export async function getPerformanceReport(
    mes: number,
    anio: number,
    ubicacionId?: string
) {
    const startOfMonth = new Date(anio, mes - 1, 1)
    const endOfMonth = new Date(anio, mes, 0, 23, 59, 59, 999)

    const whereUbi = ubicacionId ? { ubicacionId } : {}

    // ── 1. Producción por coordinador ──
    const lotes = await prisma.lote.findMany({
        where: {
            fechaProduccion: { gte: startOfMonth, lte: endOfMonth },
            estado: { not: 'en_produccion' },
            ...whereUbi
        },
        include: {
            coordinador: { select: { id: true, nombre: true, apellido: true } },
            producto: { select: { nombre: true } }
        }
    })

    const porCoordinador: Record<string, {
        nombre: string; lotes: number; paquetes: number; rechazados: number; merma: number
    }> = {}

    for (const lote of lotes) {
        const coord = lote.coordinador
        const key = coord ? coord.id : 'sin-asignar'
        const nombre = coord ? `${coord.nombre} ${coord.apellido || ''}`.trim() : 'Sin asignar'

        if (!porCoordinador[key]) {
            porCoordinador[key] = { nombre, lotes: 0, paquetes: 0, rechazados: 0, merma: 0 }
        }
        porCoordinador[key].lotes++
        porCoordinador[key].paquetes += lote.unidadesProducidas
        porCoordinador[key].rechazados += lote.unidadesRechazadas
    }

    // Calcular merma
    for (const key of Object.keys(porCoordinador)) {
        const c = porCoordinador[key]
        c.merma = c.paquetes > 0 ? (c.rechazados / c.paquetes) * 100 : 0
    }

    const rankingCoordinadores = Object.values(porCoordinador)
        .sort((a, b) => b.paquetes - a.paquetes)

    // ── 2. Cumplimiento de entregas ──
    const rutas = await prisma.ruta.findMany({
        where: {
            fecha: { gte: startOfMonth, lte: endOfMonth },
            ...(ubicacionId ? { ubicacionOrigenId: ubicacionId } : {})
        },
        include: {
            chofer: { select: { nombre: true, apellido: true } },
            entregas: {
                select: {
                    dentroVentana: true,
                    unidadesRechazadas: true,
                    horaEntrega: true
                }
            }
        }
    })

    let totalEntregas = 0
    let entregasDentroVentana = 0
    let entregasConRechazo = 0
    let kmTotales = 0

    const porChofer: Record<string, {
        nombre: string; rutas: number; entregas: number;
        dentroVentana: number; rechazos: number; km: number
    }> = {}

    for (const ruta of rutas) {
        kmTotales += ruta.kmRecorridos
        const choferNombre = `${ruta.chofer.nombre} ${ruta.chofer.apellido || ''}`.trim()

        if (!porChofer[ruta.choferId]) {
            porChofer[ruta.choferId] = {
                nombre: choferNombre,
                rutas: 0, entregas: 0, dentroVentana: 0, rechazos: 0, km: 0
            }
        }
        const ch = porChofer[ruta.choferId]
        ch.rutas++
        ch.km += ruta.kmRecorridos

        for (const ent of ruta.entregas) {
            totalEntregas++
            ch.entregas++
            if (ent.dentroVentana) { entregasDentroVentana++; ch.dentroVentana++ }
            if (ent.unidadesRechazadas > 0) { entregasConRechazo++; ch.rechazos++ }
        }
    }

    const cumplimientoEntregas = totalEntregas > 0 ? (entregasDentroVentana / totalEntregas) * 100 : 0
    const eficienciaKm = totalEntregas > 0 ? kmTotales / totalEntregas : 0

    const rankingChoferes = Object.values(porChofer)
        .sort((a, b) => b.entregas - a.entregas)
        .map(c => ({
            ...c,
            cumplimiento: c.entregas > 0 ? (c.dentroVentana / c.entregas) * 100 : 0,
            kmPorEntrega: c.entregas > 0 ? c.km / c.entregas : 0
        }))

    // ── 3. Producción por turno (desde AsignacionOperario) ──
    const asignaciones = await prisma.asignacionOperario.findMany({
        where: {
            fecha: { gte: startOfMonth, lte: endOfMonth },
            ...whereUbi
        },
        select: { turno: true, fecha: true }
    })

    const porTurno: Record<string, number> = {}
    for (const a of asignaciones) {
        porTurno[a.turno] = (porTurno[a.turno] || 0) + 1
    }

    // Producción por día de la semana
    const porDiaSemana: Record<string, { producidos: number; lotes: number }> = {}
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

    for (const lote of lotes) {
        const dia = diasSemana[lote.fechaProduccion.getDay()]
        if (!porDiaSemana[dia]) porDiaSemana[dia] = { producidos: 0, lotes: 0 }
        porDiaSemana[dia].producidos += lote.unidadesProducidas
        porDiaSemana[dia].lotes++
    }

    const produccionDiaSemana = diasSemana
        .filter(d => porDiaSemana[d])
        .map(d => ({ dia: d, ...porDiaSemana[d] }))

    return {
        mes, anio,
        kpis: {
            totalLotes: lotes.length,
            totalPaquetes: lotes.reduce((s, l) => s + l.unidadesProducidas, 0),
            totalRutas: rutas.length,
            totalEntregas,
            cumplimientoEntregas,
            eficienciaKm,
            kmTotales
        },
        rankingCoordinadores,
        rankingChoferes,
        produccionDiaSemana,
        asignacionesPorTurno: Object.entries(porTurno).map(([turno, count]) => ({ turno, count }))
    }
}
