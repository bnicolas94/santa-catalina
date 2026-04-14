import { prisma } from '@/lib/prisma'
import type { Alerta } from '@/app/(dashboard)/reportes/components/AlertBanner'

/**
 * Detecta desvíos comparando métricas actuales vs promedio de los últimos 3 meses.
 * Genera alertas automáticas para el dashboard de reportes.
 */
export async function detectarDesvios(
    mes: number,
    anio: number,
    ubicacionId?: string
): Promise<Alerta[]> {
    const alertas: Alerta[] = []

    // Rango del mes actual
    const startActual = new Date(anio, mes - 1, 1)
    const endActual = new Date(anio, mes, 0, 23, 59, 59, 999)

    // Rango de los 3 meses anteriores para calcular promedio
    const start3Meses = new Date(anio, mes - 4, 1)
    const end3Meses = new Date(anio, mes - 1, 0, 23, 59, 59, 999)

    const whereUbicacion = ubicacionId ? { ubicacionId } : {}

    try {
        // ── 1. PRODUCCIÓN: Rechazos / Merma ──
        const [lotesActual, lotes3Meses] = await Promise.all([
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
                    fechaProduccion: { gte: start3Meses, lte: end3Meses },
                    estado: { not: 'en_produccion' },
                    ...whereUbicacion
                },
                _sum: { unidadesProducidas: true, unidadesRechazadas: true }
            })
        ])

        const producidosActual = lotesActual._sum.unidadesProducidas || 0
        const rechazadosActual = lotesActual._sum.unidadesRechazadas || 0
        const mermaActual = producidosActual > 0 ? (rechazadosActual / producidosActual) * 100 : 0

        const producidos3M = lotes3Meses._sum.unidadesProducidas || 0
        const rechazados3M = lotes3Meses._sum.unidadesRechazadas || 0
        const mermaPromedio = producidos3M > 0 ? (rechazados3M / producidos3M) * 100 : 0

        if (mermaActual > 5) {
            alertas.push({
                id: 'merma-alta',
                tipo: 'danger',
                titulo: `Merma Alta: ${mermaActual.toFixed(1)}%`,
                mensaje: `El porcentaje de rechazo este mes supera el 5%. Promedio últimos 3 meses: ${mermaPromedio.toFixed(1)}%.`,
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
        const [ingresosActual, ingresos3Meses] = await Promise.all([
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
                    fechaEntrega: { gte: start3Meses, lte: end3Meses },
                    ...(ubicacionId ? { ubicacionId } : {})
                },
                _sum: { totalImporte: true },
                _count: true
            })
        ])

        const ingresoActual = ingresosActual._sum.totalImporte || 0
        const ingresoPromMensual = (ingresos3Meses._sum.totalImporte || 0) / 3

        if (ingresoPromMensual > 0 && ingresoActual < ingresoPromMensual * 0.8) {
            const caida = ((ingresoPromMensual - ingresoActual) / ingresoPromMensual * 100).toFixed(1)
            alertas.push({
                id: 'caida-ingresos',
                tipo: 'warning',
                titulo: `Caída de Ingresos: -${caida}%`,
                mensaje: `Los ingresos de este mes ($${Math.round(ingresoActual).toLocaleString()}) están por debajo del promedio mensual ($${Math.round(ingresoPromMensual).toLocaleString()}).`,
                accion: 'Evaluar si es efecto estacional o si hay clientes que dejaron de comprar.'
            })
        }

        // ── 3. GASTOS: Aumento de costos ──
        const [gastosActual, gastos3Meses] = await Promise.all([
            prisma.gastoOperativo.aggregate({
                where: {
                    fecha: { gte: startActual, lte: endActual },
                    ...(ubicacionId ? { ubicacionId } : {})
                },
                _sum: { monto: true }
            }),
            prisma.gastoOperativo.aggregate({
                where: {
                    fecha: { gte: start3Meses, lte: end3Meses },
                    ...(ubicacionId ? { ubicacionId } : {})
                },
                _sum: { monto: true }
            })
        ])

        const gastoActual = gastosActual._sum.monto || 0
        const gastoPromMensual = (gastos3Meses._sum.monto || 0) / 3

        if (gastoPromMensual > 0 && gastoActual > gastoPromMensual * 1.15) {
            const aumento = ((gastoActual - gastoPromMensual) / gastoPromMensual * 100).toFixed(1)
            alertas.push({
                id: 'aumento-gastos',
                tipo: 'warning',
                titulo: `Aumento de Gastos: +${aumento}%`,
                mensaje: `Los gastos operativos ($${Math.round(gastoActual).toLocaleString()}) superan en más de 15% al promedio mensual ($${Math.round(gastoPromMensual).toLocaleString()}).`,
                accion: 'Revisar las categorías de gasto para identificar dónde se concentra el aumento.'
            })
        }

        // ── 4. PRODUCCIÓN: Baja producción ──
        const produccionPromMensual = producidos3M / 3
        if (produccionPromMensual > 0 && producidosActual < produccionPromMensual * 0.7) {
            const caida = ((produccionPromMensual - producidosActual) / produccionPromMensual * 100).toFixed(1)
            alertas.push({
                id: 'baja-produccion',
                tipo: 'info',
                titulo: `Producción por debajo del promedio: -${caida}%`,
                mensaje: `Se produjeron ${producidosActual.toLocaleString()} paquetes vs un promedio de ${Math.round(produccionPromMensual).toLocaleString()}/mes.`,
                accion: 'Verificar si hubo paradas programadas o si la demanda bajó.'
            })
        }

        // ── 5. INSIGHT POSITIVO ──
        if (ingresoPromMensual > 0 && ingresoActual > ingresoPromMensual * 1.2) {
            const crecimiento = ((ingresoActual - ingresoPromMensual) / ingresoPromMensual * 100).toFixed(1)
            alertas.push({
                id: 'crecimiento-ingresos',
                tipo: 'success',
                titulo: `Crecimiento de Ingresos: +${crecimiento}%`,
                mensaje: `Los ingresos de este mes superan el promedio histórico. ¡Buen desempeño!`,
                accion: 'Mantener la estrategia actual y evaluar si es posible escalar.'
            })
        }

    } catch (error) {
        console.error('Error detectando desvíos:', error)
    }

    return alertas
}
