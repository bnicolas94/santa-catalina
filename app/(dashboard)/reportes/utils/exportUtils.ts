import * as XLSX from 'xlsx'

export async function exportReportToExcel(
    data: any, 
    tipo: 'economico' | 'produccion',
    mes: string,
    anio: string
) {
    const wb = XLSX.utils.book_new()

    if (tipo === 'economico') {
        const resumen = [
            ['Reporte Económico', `${mes}/${anio}`],
            [''],
            ['Métrica', 'Valor'],
            ['Ingresos Brutos', data.ingresosTotales],
            ['Margen de Contribución', data.margenBruto],
            ['Gastos Operativos', data.totalGastos],
            ['EBITDA', data.rentabilidadNeta],
            ['Margen EBITDA (%)', data.margenEbitda.toFixed(2) + '%'],
            [''],
            ['Desglose de Gastos'],
            ...Object.entries(data.gastosPorCategoria).map(([cat, monto]) => [cat, monto])
        ]
        const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Económico')
    } else {
        const resumen = [
            ['Reporte de Producción', `${mes}/${anio}`],
            [''],
            ['Métrica', 'Valor'],
            ['Total Paquetes', data.globales.totalPaquetes],
            ['Total Planchas', data.globales.totalPlanchas],
            ['Total Sanguchitos', data.globales.totalSanguchitos],
            ['Total Rechazos', data.globales.totalRechazados],
            [''],
            ['Desglose por Producto'],
            ['Producto', 'Código', 'Paquetes', 'Planchas', 'Sanguchitos', 'Rechazos'],
            ...data.desglose.map((p: any) => [p.nombre, p.codigo, p.paquetes, p.planchas, p.sanguchitos, p.rechazados])
        ]
        const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Producción')

        const tendencia = [
            ['Semana', 'Paquetes'],
            ...data.tendencia.map((t: any) => [t.semana, t.paquetes])
        ]
        const wsTendencia = XLSX.utils.aoa_to_sheet(tendencia)
        XLSX.utils.book_append_sheet(wb, wsTendencia, 'Tendencia Semanal')
    }

    XLSX.writeFile(wb, `Reporte_SantaCatalina_${tipo}_${mes}_${anio}.xlsx`)
}
