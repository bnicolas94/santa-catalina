'use client'

import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import DataTable from '../components/DataTable'
import { formatNumber } from '../utils/formatters'
import type { ReporteProduccion } from '@/lib/reportes/produccion'

interface Props {
    data: ReporteProduccion | null
    loading: boolean
    userPrefs: Record<string, boolean>
    onDrillDown: (tipo: string, label: string) => void
}

export default function ProduccionSection({ data, loading, userPrefs, onDrillDown }: Props) {
    if (loading && !data) return <div className="empty-state"><div className="spinner" /><p>Calculando producción...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos disponibles para el periodo seleccionado.</p></div>

    const g = data.globales
    const fecha = (iso: string) => iso.split('-').reverse().join('/')
    const variacion = (n: number | null) => n === null ? 'Sin base anterior'
        : `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`
    const columns = [
        { key: 'nombre', label: 'Producto', sortable: true },
        { key: 'codigo', label: 'Código', sortable: true, width: '100px' },
        ...(userPrefs.showProdPaquetes ? [{ key: 'paquetes', label: 'Paquetes', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) }] : []),
        { key: 'aptos', label: 'Aptos', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'participacion', label: '% del total', align: 'right' as const, sortable: true, format: (v: number) => `${v.toFixed(1).replace('.', ',')} %` },
        { key: 'paquetesAnteriores', label: 'Anterior', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'variacion', label: 'Variación', align: 'right' as const, sortable: true, format: (v: number | null) => variacion(v) },
        ...(userPrefs.showProdPlanchas ? [{ key: 'planchas', label: 'Planchas', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) }] : []),
        ...(userPrefs.showProdSanguchitos ? [{ key: 'sanguchitos', label: 'Sanguchitos', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) }] : []),
        ...(userPrefs.showProdRechazados ? [{ key: 'rechazados', label: 'Rechazos', align: 'right' as const, sortable: true, format: (v: number) => v > 0 ? `⚠ ${formatNumber(v)}` : '0' }] : []),
    ]

    const totalCols = []
    if (userPrefs.showProdPaquetes) totalCols.push('paquetes')
    totalCols.push('aptos', 'paquetesAnteriores')
    if (userPrefs.showProdPlanchas) totalCols.push('planchas')
    if (userPrefs.showProdSanguchitos) totalCols.push('sanguchitos')
    if (userPrefs.showProdRechazados) totalCols.push('rechazados')

    return (
        <div className="fade-in">
            <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                <strong>Producción registrada · {fecha(data.desde)} al {fecha(data.hasta)}</strong>
                <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--color-gray-600)' }}>
                    Los paquetes elaborados incluyen rechazos. Comparación con los {g.diasPeriodo} días consecutivos anteriores
                    ({fecha(data.periodoAnterior.desde)} al {fecha(data.periodoAnterior.hasta)}):
                    {' '}{formatNumber(g.paquetesAnteriores)} paquetes · {variacion(g.variacionPaquetes)}.
                </p>
            </div>
            {/* KPIs */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                {userPrefs.showProdPaquetes && (
                    <KpiCardEnhanced
                        label="Paquetes elaborados"
                        value={formatNumber(data.globales.totalPaquetes)}
                        icon="📦"
                        color="var(--color-primary)"
                        onClick={() => onDrillDown('lotes', 'Detalle de Lotes')}
                    />
                )}
                <KpiCardEnhanced label="Paquetes aptos" value={formatNumber(g.totalAptos)}
                    icon="✅" color="var(--color-success)" footer="Elaborados menos rechazados" />
                {userPrefs.showProdPlanchas && (
                    <KpiCardEnhanced
                        label="Total Planchas"
                        value={formatNumber(data.globales.totalPlanchas)}
                        icon="🔲"
                        color="var(--color-secondary)"
                    />
                )}
                {userPrefs.showProdRechazados && (
                    <KpiCardEnhanced
                        label="Merma / Rechazos"
                        value={formatNumber(data.globales.totalRechazados)}
                        icon="🗑️"
                        color="var(--color-danger)"
                        footer={`${g.tasaRechazo.toFixed(1).replace('.', ',')} % de los elaborados`}
                    />
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                {([
                    ['Lotes cerrados', formatNumber(g.totalLotes)],
                    ...(userPrefs.showProdSanguchitos ? [['Sándwiches elaborados', formatNumber(g.totalSanguchitos)]] : []),
                    ['Días con producción', `${formatNumber(g.diasActivos)} / ${formatNumber(g.diasPeriodo)}`],
                    ['Promedio por día activo', formatNumber(Math.round(g.promedioPorDiaActivo))],
                    ['Promedio por lote', formatNumber(Math.round(g.promedioPorLote))],
                    ['Productos elaborados', formatNumber(g.productosDistintos)],
                    ['Día de mayor producción', g.diaPico ? `${fecha(g.diaPico.fecha)} · ${formatNumber(g.diaPico.paquetes)}` : 'Sin datos']
                ] as [string, string][]).map(([label, value]) => <div key={label} className="card" style={{ padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>{label}</div>
                    <strong style={{ fontSize: 'var(--text-lg)' }}>{value}</strong>
                </div>)}
            </div>

            {(g.presentacionEstimada > 0 || g.lotesInvalidos > 0) && <div className="card"
                style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)', borderLeft: '4px solid #d99a00' }}>
                {g.presentacionEstimada > 0 && <p>{formatNumber(g.presentacionEstimada)} lotes sin presentación base identificable: las planchas y sándwiches usan el multiplicador del producto o la configuración general.</p>}
                {g.lotesInvalidos > 0 && <p>{formatNumber(g.lotesInvalidos)} lotes con cantidades incoherentes quedaron fuera de los totales.</p>}
            </div>}

            {/* Charts + Table */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)'
            }}>
                {/* Tendencia de Producción */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <TrendChart
                        title={g.diasPeriodo <= 31 ? 'Evolución diaria' : 'Evolución por tramos de 7 días'}
                        labels={data.tendencia.map(t => t.semana)}
                        type="line"
                        datasets={[{
                            label: 'Paquetes Producidos',
                            data: data.tendencia.map(t => t.paquetes),
                            color: '#3498DB'
                        }]}
                    />
                </div>

                {/* Desglose por producto */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <TrendChart
                        title="Productos con más producción"
                        labels={data.desglose.slice(0, 8).map(d => d.nombre)}
                        datasets={[{
                            label: 'Paquetes',
                            data: data.desglose.slice(0, 8).map(d => d.paquetes),
                            color: 'var(--color-primary)'
                        }]}
                        showLegend={false}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-gray-600)',
                    marginBottom: 'var(--space-4)',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.03em'
                }}>
                    Producción por producto · participación y período anterior
                </h3>
                <DataTable
                    columns={columns}
                    data={data.desglose}
                    showTotals={true}
                    totalColumns={totalCols}
                    exportFilename={`Produccion_Desglose`}
                />
            </div>
        </div>
    )
}
