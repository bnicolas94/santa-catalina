import { prisma } from '@/lib/prisma'
import type { Alerta } from '@/app/(dashboard)/reportes/components/AlertBanner'

/**
 * Detecta desvíos comparando métricas actuales vs promedio de los últimos 3 meses.
 * Genera alertas automáticas para el dashboard de reportes.
 */
export async function detectarDesvios(
    desdeIso: string,
    hastaIso: string,
    ubicacionId?: string
): Promise<Alerta[]> {
    const alertas: Alerta[] = []

    const startActual = new Date(desdeIso)
    const endActual = new Date(hastaIso)

    const diffMs = endActual.getTime() - startActual.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    // Rango de los 3 periodos anteriores para calcular promedio
    const start3Periodos = new Date(startActual)
    start3Periodos.setDate(start3Periodos.getDate() - (diffDays * 3))
    start3Periodos.setHours(0, 0, 0, 0)

    const end3Periodos = new Date(startActual)
    end3Periodos.setDate(end3Periodos.getDate() - 1)
    end3Periodos.setHours(23, 59, 59, 999)

    const whereUbicacion = ubicacionId ? { ubicacionId } : {}

    try {
        // ── 1. PRODUCCIÓN: Rechazos / Merma ──
        const [lotesActual, lotesHistoricos] = await Promise.all([
            prisma.lote.aggregate({
                where: {
                    fechaProduccion: { gte: startActual, lte: endActual },
                    estado: { not: 'en_produccion' },
                    ...whereUbicacion
                },
                _sum: { unidadesProducidas: true, unidadesRechazadas: true }
            }),
            prisma.lote.aggregate({
                where: {
                    fechaProduccion: { gte: start3Periodos, lte: end3Periodos },
                    estado: { not: 'en_produccion' },
                    ...whereUbicacion
                },
                _sum: { unidadesProducidas: true, unidadesRechazadas: true }
            })
        ])

        const producidosActual = lotesActual._sum.unidadesProducidas || 0
        const rechazadosActual = lotesActual._sum.unidadesRechazadas || 0
        const mermaActual = producidosActual > 0 ? (rechazadosActual / producidosActual) * 100 : 0

        const producidosHist = lotesHistoricos._sum.unidadesProducidas || 0
        const rechazadosHist = lotesHistoricos._sum.unidadesRechazadas || 0
        const mermaPromedio = producidosHist > 0 ? (rechazadosHist / producidosHist) * 100 : 0

        if (mermaActual > 5) {
            alertas.push({
                id: 'merma-alta',
                tipo: 'danger',
                titulo: `Merma Alta: ${mermaActual.toFixed(1)}%`,
                mensaje: `El porcentaje de rechazo en este periodo supera el 5%. Promedio histórico: ${mermaPromedio.toFixed(1)}%.`,
                accion: 'Revisar lotes con mayor cantidad de rechazos e investigar causas.'
            })
        } else if (mermaActual > mermaPromedio * 1.5 && mermaPromedio > 0) {
            alertas.push({
                id: 'merma-incremento',
                tipo: 'warning',
                titulo: `Incremento de Merma`,
                mensaje: `La merma (${mermaActual.toFixed(1)}%) es significativamente mayor al promedio histórico (${mermaPromedio.toFixed(1)}%).`,
                accion: 'Monitorear los próximos lotes para detectar si es una tendencia.'
            })
        }

        // ── 2. INGRESOS: Caída de ventas ──
        const [ingresosActual, ingresosHistoricos] = await Promise.all([
            prisma.pedido.aggregate({
                where: {
                    estado: 'entregado',
                    fechaEntrega: { gte: startActual, lte: endActual },
                    ...(ubicacionId ? { ubicacionId } : {})
                },
                _sum: { totalImporte: true },
                _count: true
            }),
            prisma.pedido.aggregate({
                where: {
                    estado: 'entregado',
                    fechaEntrega: { gte: start3Periodos, lte: end3Periodos },
                    ...(ubicacionId ? { ubicacionId } : {})
                },
                _sum: { totalImporte: true },
                _count: true
            })
        ])

        const ingresoActual = ingresosActual._sum.totalImporte || 0
        const ingresoPromHistorico = (ingresosHistoricos._sum.totalImporte || 0) / 3

        if (ingresoPromHistorico > 0 && ingresoActual < ingresoPromHistorico * 0.8) {
            const caida = ((ingresoPromHistorico - ingresoActual) / ingresoPromHistorico * 100).toFixed(1)
            alertas.push({
                id: 'caida-ingresos',
                tipo: 'warning',
                titulo: `Caída de Ingresos: -${caida}%`,
                mensaje: `Los ingresos de este periodo ($${Math.round(ingresoActual).toLocaleString()}) están por debajo del promedio histórico ($${Math.round(ingresoPromHistorico).toLocaleString()}).`,
                accion: 'Evaluar patron de clientes.'
            })
        }

        // ── 3. GASTOS: Aumento de costos ──
        const [gastosActual, gastosHistoricos] = await Promise.all([
            prisma.gastoOperativo.aggregate({
                where: {
                    fecha: { gte: startActual, lte: endActual },
                    ...(ubicacionId ? { ubicacionId } : {})
                },
                _sum: { monto: true }
            }),
            prisma.gastoOperativo.aggregate({
                where: {
                    fecha: { gte: start3Periodos, lte: end3Periodos },
                    ...(ubicacionId ? { ubicacionId } : {})
                },
                _sum: { monto: true }
            })
        ])

        const gastoActual = gastosActual._sum.monto || 0
        const gastoPromHistorico = (gastosHistoricos._sum.monto || 0) / 3

        if (gastoPromHistorico > 0 && gastoActual > gastoPromHistorico * 1.15) {
            const aumento = ((gastoActual - gastoPromHistorico) / gastoPromHistorico * 100).toFixed(1)
            alertas.push({
                id: 'aumento-gastos',
                tipo: 'warning',
                titulo: `Aumento de Gastos: +${aumento}%`,
                mensaje: `Los gastos operativos ($${Math.round(gastoActual).toLocaleString()}) superan en más de 15% al promedio histórico ($${Math.round(gastoPromHistorico).toLocaleString()}).`,
                accion: 'Revisar las categorías de gasto.'
            })
        }

        // ── 4. PRODUCCIÓN: Baja producción ──
        const produccionPromHistorico = producidosHist / 3
        if (produccionPromHistorico > 0 && producidosActual < produccionPromHistorico * 0.7) {
            const caida = ((produccionPromHistorico - producidosActual) / produccionPromHistorico * 100).toFixed(1)
            alertas.push({
                id: 'baja-produccion',
                tipo: 'info',
                titulo: `Producción por debajo del promedio: -${caida}%`,
                mensaje: `Se produjeron ${producidosActual.toLocaleString()} paquetes vs un promedio de ${Math.round(produccionPromHistorico).toLocaleString()}.`,
                accion: 'Verificar si hubo paradas programadas o si la demanda bajó.'
            })
        }

        // ── 5. INSIGHT POSITIVO ──
        if (ingresoPromHistorico > 0 && ingresoActual > ingresoPromHistorico * 1.2) {
            const crecimiento = ((ingresoActual - ingresoPromHistorico) / ingresoPromHistorico * 100).toFixed(1)
            alertas.push({
                id: 'crecimiento-ingresos',
                tipo: 'success',
                titulo: `Crecimiento de Ingresos: +${crecimiento}%`,
                mensaje: `Los ingresos de este periodo superan el promedio histórico. ¡Buen desempeño!`,
                accion: 'Mantener la estrategia actual y evaluar si es posible escalar.'
            })
        }

    } catch (error) {
        console.error('Error detectando desvíos:', error)
    }

    return alertas
}
