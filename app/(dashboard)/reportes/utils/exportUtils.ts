import * as XLSX from 'xlsx'

/**
 * Exporta reportes a Excel con formato profesional.
 * Soporta múltiples secciones del módulo de reportes.
 */
export async function exportReportToExcel(
    data: any,
    tipo: 'economico' | 'produccion' | 'ventas' | 'costos' | 'desperdicio' | 'performance',
    mes: string,
    anio: string
) {
    const wb = XLSX.utils.book_new()

    switch (tipo) {
        case 'economico':
            exportEconomico(wb, data, mes, anio)
            break
        case 'produccion':
            exportProduccion(wb, data, mes, anio)
            break
        case 'ventas':
            exportVentas(wb, data, mes, anio)
            break
        case 'costos':
            exportCostos(wb, data, mes, anio)
            break
        case 'desperdicio':
            exportDesperdicio(wb, data, mes, anio)
            break
        case 'performance':
            exportPerformance(wb, data, mes, anio)
            break
    }

    XLSX.writeFile(wb, `Reporte_SantaCatalina_${tipo}_${mes}_${anio}.xlsx`)
}

function exportEconomico(wb: XLSX.WorkBook, data: any, mes: string, anio: string) {
    const resumen = [
        ['Reporte Económico — Santa Catalina', `${mes}/${anio}`],
        [''],
        ['Métrica', 'Valor'],
        ['Ingresos Brutos', data.ingresosTotales],
        ['Costo de Mercadería Vendida', data.costoMercaderiaVendida],
        ['Margen de Contribución', data.margenBruto],
        ['Gastos Operativos', data.totalGastos],
        ['EBITDA', data.rentabilidadNeta],
        ['Margen EBITDA (%)', data.margenEbitda?.toFixed(2) + '%'],
        [''],
        ['Desglose de Gastos por Categoría'],
        ['Categoría', 'Monto'],
        ...Object.entries(data.gastosPorCategoria || {}).map(([cat, monto]) => [cat, monto])
    ]
    const ws = XLSX.utils.aoa_to_sheet(resumen)
    setColumnWidths(ws, [40, 20])
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen Económico')
}

function exportProduccion(wb: XLSX.WorkBook, data: any, mes: string, anio: string) {
    // Hoja 1: Resumen
    const resumen = [
        ['Reporte de Producción — Santa Catalina', `${mes}/${anio}`],
        [''],
        ['Métrica', 'Valor'],
        ['Total Paquetes', data.globales.totalPaquetes],
        ['Total Planchas', data.globales.totalPlanchas],
        ['Total Sanguchitos', data.globales.totalSanguchitos],
        ['Total Rechazos', data.globales.totalRechazados],
        ['Total Lotes', data.globales.totalLotes],
    ]
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
    setColumnWidths(wsResumen, [30, 15])
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    // Hoja 2: Desglose
    const desglose = [
        ['Producto', 'Código', 'Paquetes', 'Planchas', 'Sanguchitos', 'Rechazos'],
        ...data.desglose.map((p: any) => [p.nombre, p.codigo, p.paquetes, p.planchas, p.sanguchitos, p.rechazados])
    ]
    const wsDesglose = XLSX.utils.aoa_to_sheet(desglose)
    setColumnWidths(wsDesglose, [30, 12, 12, 12, 14, 12])
    XLSX.utils.book_append_sheet(wb, wsDesglose, 'Desglose')

    // Hoja 3: Tendencia
    const tendencia = [
        ['Semana', 'Paquetes'],
        ...data.tendencia.map((t: any) => [t.semana, t.paquetes])
    ]
    const wsTendencia = XLSX.utils.aoa_to_sheet(tendencia)
    XLSX.utils.book_append_sheet(wb, wsTendencia, 'Tendencia')
}

function exportVentas(wb: XLSX.WorkBook, data: any, mes: string, anio: string) {
    // Hoja 1: KPIs
    const k = data.kpis
    const resumen = [
        ['Reporte de Ventas — Santa Catalina', `${mes}/${anio}`],
        [''],
        ['Métrica', 'Actual', 'Mes Anterior'],
        ['Facturación Total', k.facturacionTotal, k.facturacionAnterior],
        ['Pedidos Entregados', k.pedidoCount, k.pedidoCountAnterior],
        ['Unidades Vendidas', k.unidadesTotales, k.unidadesAnterior],
        ['Ticket Promedio', k.ticketPromedio, k.ticketPromedioAnterior],
    ]
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
    setColumnWidths(wsResumen, [30, 18, 18])
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    // Hoja 2: Ranking Productos
    const prods = [
        ['#', 'Producto', 'Código', 'Unidades', 'Facturado', '% Participación'],
        ...data.rankingProductos.map((p: any) => [
            p.ranking, p.nombre, p.codigo, p.cantidad, p.importe,
            (p.participacion || 0).toFixed(1) + '%'
        ])
    ]
    const wsProds = XLSX.utils.aoa_to_sheet(prods)
    setColumnWidths(wsProds, [5, 30, 12, 12, 14, 14])
    XLSX.utils.book_append_sheet(wb, wsProds, 'Productos')

    // Hoja 3: Ranking Clientes
    const clients = [
        ['#', 'Cliente', 'Zona', 'Pedidos', 'Facturado', '% Participación'],
        ...data.rankingClientes.map((c: any) => [
            c.ranking, c.nombre, c.zona, c.pedidos, c.importe,
            (c.participacion || 0).toFixed(1) + '%'
        ])
    ]
    const wsClients = XLSX.utils.aoa_to_sheet(clients)
    setColumnWidths(wsClients, [5, 30, 15, 10, 14, 14])
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clientes')

    // Hoja 4: Tendencia diaria
    if (data.tendenciaDiaria?.length > 0) {
        const daily = [
            ['Fecha', 'Facturación', 'Pedidos', 'Unidades'],
            ...data.tendenciaDiaria.map((d: any) => [d.fecha, d.importe, d.pedidos, d.unidades])
        ]
        const wsDaily = XLSX.utils.aoa_to_sheet(daily)
        setColumnWidths(wsDaily, [14, 14, 10, 12])
        XLSX.utils.book_append_sheet(wb, wsDaily, 'Tendencia Diaria')
    }
}

function exportCostos(wb: XLSX.WorkBook, data: any, mes: string, anio: string) {
    // Hoja 1: KPIs
    const k = data.kpis
    const resumen = [
        ['Reporte de Costos — Santa Catalina', `${mes}/${anio}`],
        [''],
        ['Métrica', 'Actual', 'Mes Anterior'],
        ['Costo Total', k.costoTotal, k.costoTotalAnterior],
        ['Compra Insumos', k.costoInsumosActual, k.costoInsumosAnterior],
        ['Gastos Operativos', k.gastosTotalActual, k.gastosTotalAnterior],
        ['Margen Promedio Productos', (k.margenPromedioProductos || 0).toFixed(1) + '%', ''],
    ]
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
    setColumnWidths(wsResumen, [30, 18, 18])
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    // Hoja 2: Margen por producto
    const prods = [
        ['Producto', 'Costo/u', 'Cant.', 'Precio Vta.', 'Costo Total', 'Margen %'],
        ...data.costoPorProducto.map((p: any) => [
            p.nombre, p.costoUnitario, p.cantidadPresentacion,
            p.precioVenta, p.costoTotal, (p.margenPct || 0).toFixed(1) + '%'
        ])
    ]
    const wsProds = XLSX.utils.aoa_to_sheet(prods)
    setColumnWidths(wsProds, [30, 12, 8, 14, 14, 12])
    XLSX.utils.book_append_sheet(wb, wsProds, 'Margen Productos')

    // Hoja 3: Top insumos
    const insumos = [
        ['Insumo', 'Cantidad', 'Unidad', 'Compras', 'Costo Total'],
        ...data.rankingInsumos.map((i: any) => [i.nombre, i.cantidadComprada, i.unidad, i.compras, i.costoTotal])
    ]
    const wsInsumos = XLSX.utils.aoa_to_sheet(insumos)
    setColumnWidths(wsInsumos, [30, 14, 10, 10, 14])
    XLSX.utils.book_append_sheet(wb, wsInsumos, 'Top Insumos')
}

function exportDesperdicio(wb: XLSX.WorkBook, data: any, mes: string, anio: string) {
    const k = data.kpis
    const resumen = [
        ['Reporte de Desperdicio — Santa Catalina', `${mes}/${anio}`],
        [''],
        ['Métrica', 'Valor'],
        ['% Merma Producción', (k.mermaActual || 0).toFixed(1) + '%'],
        ['% Merma Mes Anterior', (k.mermaAnterior || 0).toFixed(1) + '%'],
        ['Rechazos Producción', k.totalRechazadosProduccion],
        ['Rechazos Entrega', k.totalRechazadosEntrega],
        ['Costo Estimado Desperdicio', k.costoDesperdicioTotal],
    ]
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
    setColumnWidths(wsResumen, [30, 18])
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    if (data.rankingProductos?.length > 0) {
        const prods = [
            ['Producto', 'Producidos', 'Rechazados', '% Merma', 'Costo Desperdicio', 'Motivos'],
            ...data.rankingProductos.map((p: any) => [
                p.nombre, p.producidos, p.rechazados,
                (p.merma || 0).toFixed(1) + '%', p.costoDesperdicio,
                p.motivos?.join(', ') || ''
            ])
        ]
        const wsProds = XLSX.utils.aoa_to_sheet(prods)
        setColumnWidths(wsProds, [30, 12, 12, 10, 16, 30])
        XLSX.utils.book_append_sheet(wb, wsProds, 'Merma Productos')
    }

    if (data.rechazosEntrega?.length > 0) {
        const entregas = [
            ['Fecha', 'Cliente', 'Zona', 'Uds. Rechazadas', 'Motivo'],
            ...data.rechazosEntrega.map((e: any) => [
                new Date(e.fecha).toLocaleDateString('es-AR'),
                e.cliente, e.zona, e.unidades, e.motivo
            ])
        ]
        const wsEntregas = XLSX.utils.aoa_to_sheet(entregas)
        setColumnWidths(wsEntregas, [12, 30, 15, 14, 30])
        XLSX.utils.book_append_sheet(wb, wsEntregas, 'Rechazos Entrega')
    }
}

function exportPerformance(wb: XLSX.WorkBook, data: any, mes: string, anio: string) {
    const k = data.kpis
    const resumen = [
        ['Reporte de Performance — Santa Catalina', `${mes}/${anio}`],
        [''],
        ['Métrica', 'Valor'],
        ['Total Lotes', k.totalLotes],
        ['Total Paquetes', k.totalPaquetes],
        ['Total Rutas', k.totalRutas],
        ['Total Entregas', k.totalEntregas],
        ['% Cumplimiento Entregas', (k.cumplimientoEntregas || 0).toFixed(1) + '%'],
        ['Km Totales', k.kmTotales],
        ['Km por Entrega', (k.eficienciaKm || 0).toFixed(1)],
    ]
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
    setColumnWidths(wsResumen, [30, 18])
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    if (data.rankingCoordinadores?.length > 0) {
        const coords = [
            ['Coordinador', 'Lotes', 'Paquetes', 'Rechazos', '% Merma'],
            ...data.rankingCoordinadores.map((c: any) => [
                c.nombre, c.lotes, c.paquetes, c.rechazados, (c.merma || 0).toFixed(1) + '%'
            ])
        ]
        const wsCoords = XLSX.utils.aoa_to_sheet(coords)
        setColumnWidths(wsCoords, [25, 8, 12, 12, 10])
        XLSX.utils.book_append_sheet(wb, wsCoords, 'Coordinadores')
    }

    if (data.rankingChoferes?.length > 0) {
        const choferes = [
            ['Chofer', 'Rutas', 'Entregas', '% Cumplimiento', 'Km', 'Km/Entrega'],
            ...data.rankingChoferes.map((c: any) => [
                c.nombre, c.rutas, c.entregas,
                (c.cumplimiento || 0).toFixed(1) + '%',
                c.km, (c.kmPorEntrega || 0).toFixed(1)
            ])
        ]
        const wsChoferes = XLSX.utils.aoa_to_sheet(choferes)
        setColumnWidths(wsChoferes, [25, 8, 10, 14, 10, 12])
        XLSX.utils.book_append_sheet(wb, wsChoferes, 'Choferes')
    }
}

/**
 * Helper para establecer anchos de columna.
 */
function setColumnWidths(ws: XLSX.WorkSheet, widths: number[]) {
    ws['!cols'] = widths.map(w => ({ wch: w }))
}
