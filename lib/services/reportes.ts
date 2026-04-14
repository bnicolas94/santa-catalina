import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

/**
 * SERVICIOS DE CONFIGURACIÓN Y METADATA
 */

export const getReportesMetadata = async () => {
    const [ubicaciones, categorias] = await Promise.all([
        prisma.ubicacion.findMany({ 
            where: { activo: true },
            select: { id: true, nombre: true, tipo: true } 
        }),
        prisma.categoriaGasto.findMany({ 
            select: { id: true, nombre: true, esOperativo: true } 
        } as any)
    ])

    const startYear = 2024
    const currentYear = new Date().getFullYear()
    const years = []
    for (let y = startYear; y <= currentYear; y++) years.push(y.toString())

    return { ubicaciones, years, categoriasGasto: categorias }
}

export const getGlobalConfig = async (clave: string, defaultValue: any) => {
    try {
        const config = await (prisma as any).configuracionGlobal.findUnique({ where: { clave } })
        if (!config) return defaultValue
        return JSON.parse(config.valor)
    } catch (e) {
        return defaultValue
    }
}

export const updateGlobalConfig = async (clave: string, valor: any) => {
    const valorStr = typeof valor === 'string' ? valor : JSON.stringify(valor)
    return await (prisma as any).configuracionGlobal.upsert({
        where: { clave },
        update: { valor: valorStr },
        create: { clave, valor: valorStr, descripcion: `Configuración de ${clave}` }
    })
}

export const getUserReportPrefs = async (userId: string) => {
    const user = await prisma.empleado.findUnique({
        where: { id: userId },
        select: { preferenciasReporte: true }
    } as any)
    const defaultPrefs = {
        showIngresos: true,
        showGastos: true,
        showMargen: true,
        showProduccion: true,
        showProdPaquetes: true,
        showProdPlanchas: true,
        showProdSanguchitos: true,
        showProdRechazados: true
    }
    return { ...defaultPrefs, ...(user?.preferenciasReporte as any) }
}

export const updateUserReportPrefs = async (userId: string, prefs: any) => {
    return await prisma.empleado.update({
        where: { id: userId },
        data: { preferenciasReporte: prefs }
    } as any)
}

export const updateCategoriaOperativa = async (id: string, esOperativo: boolean) => {
    return await prisma.categoriaGasto.update({
        where: { id },
        data: { esOperativo }
    } as any)
}

/**
 * SERVICIOS DE REPORTES
 */

export const getRentabilidadReport = unstable_cache(
    async (desdeIso: string, hastaIso: string, ubicacionId?: string) => {
        const startOfMonth = new Date(desdeIso)
        const endOfMonth = new Date(hastaIso)

        const wherePedido: any = {
            estado: 'entregado',
            fechaEntrega: { gte: startOfMonth, lte: endOfMonth }
        }
        if (ubicacionId) wherePedido.ubicacionId = ubicacionId

        const pedidos = await prisma.pedido.findMany({
            where: wherePedido,
            include: {
                detalles: {
                    include: {
                        presentacion: {
                            include: {
                                producto: {
                                    include: { fichasTecnicas: { include: { insumo: true } } }
                                }
                            }
                        }
                    }
                }
            }
        })

        let ingresosTotales = 0
        let costoMercaderiaVendida = 0

        for (const ped of pedidos) {
            ingresosTotales += ped.totalImporte
            for (const det of ped.detalles) {
                if ((det as any).costoUnitarioHistorico !== null && (det as any).costoUnitarioHistorico !== undefined) {
                    costoMercaderiaVendida += (det as any).costoUnitarioHistorico * det.cantidad
                } else {
                    let costoPorSandwich = 0
                    for (const ft of det.presentacion.producto.fichasTecnicas) {
                        costoPorSandwich += ft.cantidadPorUnidad * (ft.insumo.precioUnitario || 0)
                    }
                    costoMercaderiaVendida += costoPorSandwich * det.presentacion.cantidad * det.cantidad
                }
            }
        }

        const margenBruto = ingresosTotales - costoMercaderiaVendida

        const whereGasto: any = { fecha: { gte: startOfMonth, lte: endOfMonth } }
        if (ubicacionId) whereGasto.ubicacionId = ubicacionId

        const gastos = await prisma.gastoOperativo.findMany({
            where: whereGasto,
            include: { categoria: true }
        })

        const totalGastos = (gastos as any[])
            .filter((g) => g.categoria.esOperativo)
            .reduce((acc: number, g: any) => acc + g.monto, 0)

        const rentabilidadNeta = margenBruto - totalGastos
        const gastosPorCategoria: Record<string, number> = {}

        for (const g of gastos as any[]) {
            const catName = g.categoria.nombre
            if (g.categoria.esOperativo) {
                gastosPorCategoria[catName] = (gastosPorCategoria[catName] || 0) + g.monto
            }
        }

        return {
            desde: desdeIso,
            hasta: hastaIso,
            ubicacionId,
            ingresosTotales,
            costoMercaderiaVendida,
            margenBruto,
            totalGastos,
            rentabilidadNeta,
            gastosPorCategoria,
            margenEbitda: ingresosTotales > 0 ? (rentabilidadNeta / ingresosTotales) * 100 : 0
        }
    },
    ['reporte-rentabilidad'],
    { revalidate: 3600, tags: ['reportes'] }
)

export const getProduccionReport = unstable_cache(
    async (desdeIso: string, hastaIso: string, ubicacionId?: string) => {
        const startOfMonth = new Date(desdeIso)
        const endOfMonth = new Date(hastaIso)

        const whereLote: any = {
            fechaProduccion: { gte: startOfMonth, lte: endOfMonth },
            estado: { not: 'en_produccion' }
        }
        if (ubicacionId) whereLote.ubicacionId = ubicacionId

        const lotes = await prisma.lote.findMany({
            where: whereLote,
            include: { producto: true }
        })

        let statsGlobales = {
            totalPaquetes: 0,
            totalPlanchas: 0,
            totalSanguchitos: 0,
            totalRechazados: 0,
            totalLotes: lotes.length
        }

        const porProducto: Record<string, any> = {}

        const planchasPorPaqDefault = await getGlobalConfig('PLANCHAS_POR_PAQUETE_DEFAULT', 6)
        const sanguchitosPorPlancha = await getGlobalConfig('SANGUCHITOS_POR_PLANCHA', 8)

        for (const lote of lotes) {
            const planchasPorPaq = lote.producto.planchasPorPaquete || planchasPorPaqDefault
            const planchas = lote.unidadesProducidas * planchasPorPaq
            const sanguchitos = planchas * sanguchitosPorPlancha

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

        const cuatroSemanasAtras = new Date(endOfMonth)
        cuatroSemanasAtras.setDate(cuatroSemanasAtras.getDate() - 27)
        
        const whereTendencia: any = {
            fechaProduccion: { gte: cuatroSemanasAtras, lte: endOfMonth },
            estado: { not: 'en_produccion' }
        }
        if (ubicacionId) whereTendencia.ubicacionId = ubicacionId

        const lotesTendencia = await prisma.lote.findMany({
            where: whereTendencia,
            select: { fechaProduccion: true, unidadesProducidas: true }
        })

        const statsSemanales = []
        for (let i = 3; i >= 0; i--) {
            const start = new Date(endOfMonth)
            start.setDate(start.getDate() - (i * 7 + 6))
            start.setHours(0, 0, 0, 0)
            const end = new Date(endOfMonth)
            end.setDate(end.getDate() - (i * 7))
            end.setHours(23, 59, 59, 999)
            
            const totalSemana = lotesTendencia
                .filter(l => l.fechaProduccion >= start && l.fechaProduccion <= end)
                .reduce((acc, l) => acc + l.unidadesProducidas, 0)
            
            statsSemanales.push({ semana: `Sem -${i}`, paquetes: totalSemana })
        }

        return {
            desde: desdeIso,
            hasta: hastaIso,
            ubicacionId,
            globales: statsGlobales,
            desglose: Object.values(porProducto).sort((a: any, b: any) => b.paquetes - a.paquetes),
            tendencia: statsSemanales
        }
    },
    ['reporte-produccion'],
    { revalidate: 3600, tags: ['reportes'] }
)

export const getReporteDetalle = async (
    tipo: 'pedidos' | 'gastos' | 'lotes',
    desdeIso: string,
    hastaIso: string,
    ubicacionId?: string,
    categoriaId?: string
) => {
    const startOfMonth = new Date(desdeIso)
    const endOfMonth = new Date(hastaIso)

    if (tipo === 'pedidos') {
        const where: any = {
            estado: 'entregado',
            fechaEntrega: { gte: startOfMonth, lte: endOfMonth }
        }
        if (ubicacionId) where.ubicacionId = ubicacionId

        return await prisma.pedido.findMany({
            where,
            include: { cliente: true },
            orderBy: { fechaEntrega: 'desc' }
        })
    }

    if (tipo === 'gastos') {
        const where: any = {
            fecha: { gte: startOfMonth, lte: endOfMonth }
        }
        if (ubicacionId) where.ubicacionId = ubicacionId
        if (categoriaId) where.categoriaId = categoriaId

        return await prisma.gastoOperativo.findMany({
            where,
            include: { categoria: true },
            orderBy: { fecha: 'desc' }
        })
    }

    if (tipo === 'lotes') {
        const where: any = {
            fechaProduccion: { gte: startOfMonth, lte: endOfMonth },
            estado: { not: 'en_produccion' }
        }
        if (ubicacionId) where.ubicacionId = ubicacionId

        return await prisma.lote.findMany({
            where,
            include: { producto: true },
            orderBy: { fechaProduccion: 'desc' }
        })
    }

    return []
}
