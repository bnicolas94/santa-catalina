export type LoteReporteProduccion = {
    id: string
    fechaProduccion: Date
    estado: string
    unidadesProducidas: number
    unidadesRechazadas: number
    distribucion: unknown
    movimientosProducto: { presentacionId: string }[]
    producto: {
        id: string
        nombre: string
        codigoInterno: string
        planchasPorPaquete: number
        presentaciones: { id: string; cantidad: number }[]
    }
}

const diaMs = 86_400_000
const diaIso = (fecha: Date) => fecha.toISOString().slice(0, 10)

export function rangoProduccionArgentina(desdeIso: string, hastaIso: string) {
    const diaArgentina = (valor: string) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
            const fecha = new Date(`${valor}T00:00:00Z`)
            if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
                throw new Error('Indicá fechas válidas para el reporte de producción.')
            }
            return valor
        }
        const fecha = new Date(valor)
        if (!Number.isFinite(fecha.getTime())) throw new Error('Indicá fechas válidas para el reporte de producción.')
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha)
    }
    const desde = diaArgentina(desdeIso)
    const hasta = diaArgentina(hastaIso)
    const inicio = new Date(`${desde}T00:00:00Z`)
    const fin = new Date(`${hasta}T00:00:00Z`)
    const dias = (fin.getTime() - inicio.getTime()) / diaMs + 1
    if (dias <= 0 || dias > 366) throw new Error('Elegí un período de hasta 366 días para producción.')
    return { desde, hasta, inicio, finExclusivo: new Date(fin.getTime() + diaMs),
        inicioAnterior: new Date(inicio.getTime() - dias * diaMs), dias }
}

export type ReporteProduccion = ReturnType<typeof calcularReporteProduccion> & {
    desde: string
    hasta: string
    ubicacionId?: string
    periodoAnterior: { desde: string; hasta: string }
}

type ProductoResumen = { id: string; nombre: string; codigo: string; paquetes: number;
    aptos: number; planchas: number; sanguchitos: number; rechazados: number;
    lotes: number; paquetesAnteriores: number; participacion: number; variacion: number | null }

function planchasDelLote(lote: LoteReporteProduccion, sanguchitosPorPlancha: number, predeterminado: number) {
    const distribucion = Array.isArray(lote.distribucion) ? lote.distribucion : []
    const baseId = (distribucion[0] as { presentacionId?: unknown } | undefined)?.presentacionId
    const idsMovimiento = [...new Set(lote.movimientosProducto.map(m => m.presentacionId))]
    const presentacion = lote.producto.presentaciones.find(p => p.id === baseId)
        ?? (idsMovimiento.length === 1 ? lote.producto.presentaciones.find(p => p.id === idsMovimiento[0]) : null)
        ?? (lote.producto.presentaciones.length === 1 ? lote.producto.presentaciones[0] : null)
    if (presentacion && presentacion.cantidad > 0 && presentacion.cantidad % sanguchitosPorPlancha === 0) {
        return { planchas: presentacion.cantidad / sanguchitosPorPlancha, estimado: false }
    }
    return { planchas: lote.producto.planchasPorPaquete > 0
        ? lote.producto.planchasPorPaquete : predeterminado, estimado: true }
}

export function calcularReporteProduccion(lotes: LoteReporteProduccion[], desde: string, hasta: string,
    sanguchitosPorPlancha = 8, planchasPorPaqueteDefault = 6) {
    const inicio = new Date(`${desde}T00:00:00Z`)
    const fin = new Date(`${hasta}T00:00:00Z`)
    const diasPeriodo = (fin.getTime() - inicio.getTime()) / diaMs + 1
    const inicioAnterior = diaIso(new Date(inicio.getTime() - diasPeriodo * diaMs))
    const productos = new Map<string, ProductoResumen>()
    const porDia = new Map<string, { fecha: string; paquetes: number; aptos: number; rechazados: number; lotes: number }>()
    let totalPaquetes = 0, totalAptos = 0, totalRechazados = 0, totalPlanchas = 0,
        totalSanguchitos = 0, totalLotes = 0, paquetesAnteriores = 0, presentacionEstimada = 0, lotesInvalidos = 0

    for (const lote of lotes) {
        if (lote.estado === 'en_produccion' || lote.estado === 'cancelado') continue
        const fecha = diaIso(lote.fechaProduccion)
        const esActual = fecha >= desde && fecha <= hasta
        if (!esActual && (fecha < inicioAnterior || fecha >= desde)) continue
        const bruto = Number(lote.unidadesProducidas)
        const rechazo = Number(lote.unidadesRechazadas)
        if (!Number.isSafeInteger(bruto) || bruto <= 0 || !Number.isSafeInteger(rechazo)
            || rechazo < 0 || rechazo > bruto) { if (esActual) lotesInvalidos++; continue }
        if (!esActual) {
            paquetesAnteriores += bruto
            const previo = productos.get(lote.producto.id) ?? { id: lote.producto.id, nombre: lote.producto.nombre,
                codigo: lote.producto.codigoInterno, paquetes: 0, aptos: 0, planchas: 0,
                sanguchitos: 0, rechazados: 0, lotes: 0, paquetesAnteriores: 0, participacion: 0, variacion: null }
            previo.paquetesAnteriores += bruto
            productos.set(previo.id, previo)
            continue
        }
        const { planchas, estimado } = planchasDelLote(lote, sanguchitosPorPlancha, planchasPorPaqueteDefault)
        if (estimado) presentacionEstimada++
        const aptos = bruto - rechazo
        const totalPlanchasLote = bruto * planchas
        const totalSanguchitosLote = totalPlanchasLote * sanguchitosPorPlancha
        totalPaquetes += bruto
        totalAptos += aptos
        totalRechazados += rechazo
        totalPlanchas += totalPlanchasLote
        totalSanguchitos += totalSanguchitosLote
        totalLotes++
        const dia = porDia.get(fecha) ?? { fecha, paquetes: 0, aptos: 0, rechazados: 0, lotes: 0 }
        dia.paquetes += bruto; dia.aptos += aptos; dia.rechazados += rechazo; dia.lotes++
        porDia.set(fecha, dia)
        const producto = productos.get(lote.producto.id) ?? { id: lote.producto.id, nombre: lote.producto.nombre,
            codigo: lote.producto.codigoInterno, paquetes: 0, aptos: 0, planchas: 0,
            sanguchitos: 0, rechazados: 0, lotes: 0, paquetesAnteriores: 0, participacion: 0, variacion: null }
        producto.paquetes += bruto; producto.aptos += aptos; producto.rechazados += rechazo
        producto.planchas += totalPlanchasLote; producto.sanguchitos += totalSanguchitosLote; producto.lotes++
        productos.set(producto.id, producto)
    }

    const tendencia = [] as { semana: string; paquetes: number; rechazados: number }[]
    const ancho = diasPeriodo <= 31 ? 1 : 7
    for (let dia = 0; dia < diasPeriodo; dia += ancho) {
        const desdeGrupo = new Date(inicio.getTime() + dia * diaMs)
        const hastaGrupo = new Date(Math.min(fin.getTime(), desdeGrupo.getTime() + (ancho - 1) * diaMs))
        const fechas = Array.from({ length: Math.min(ancho, diasPeriodo - dia) }, (_, i) =>
            diaIso(new Date(desdeGrupo.getTime() + i * diaMs)))
        const valores = fechas.map(fecha => porDia.get(fecha))
        tendencia.push({ semana: ancho === 1 ? diaIso(desdeGrupo)
            : `${diaIso(desdeGrupo).slice(5)} al ${diaIso(hastaGrupo).slice(5)}`,
            paquetes: valores.reduce((total, v) => total + (v?.paquetes ?? 0), 0),
            rechazados: valores.reduce((total, v) => total + (v?.rechazados ?? 0), 0) })
    }
    const desglose = [...productos.values()].filter(p => p.paquetes > 0).map(p => ({ ...p,
        participacion: totalPaquetes ? p.paquetes / totalPaquetes * 100 : 0,
        variacion: p.paquetesAnteriores ? (p.paquetes - p.paquetesAnteriores) / p.paquetesAnteriores * 100 : null }))
        .sort((a, b) => b.paquetes - a.paquetes || a.nombre.localeCompare(b.nombre, 'es'))
    const diasActivos = porDia.size
    const diaPico = [...porDia.values()].sort((a, b) => b.paquetes - a.paquetes || a.fecha.localeCompare(b.fecha))[0] ?? null
    return {
        globales: { totalPaquetes, totalAptos, totalPlanchas, totalSanguchitos, totalRechazados,
            totalLotes, diasActivos, diasPeriodo, promedioPorDiaActivo: diasActivos ? totalPaquetes / diasActivos : 0,
            promedioPorLote: totalLotes ? totalPaquetes / totalLotes : 0,
            tasaRechazo: totalPaquetes ? totalRechazados / totalPaquetes * 100 : 0,
            productosDistintos: desglose.length, diaPico,
            paquetesAnteriores, variacionPaquetes: paquetesAnteriores
                ? (totalPaquetes - paquetesAnteriores) / paquetesAnteriores * 100 : null,
            presentacionEstimada, lotesInvalidos },
        desglose, tendencia,
        porDia: [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    }
}
