'use client'

import React, { useState, useEffect } from 'react'
import type { RangoFechas } from '../utils/dateUtils'
import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import DataTable from '../components/DataTable'
import { formatCurrency, formatPercent, formatNumber, formatDelta } from '../utils/formatters'

interface Props {
    rango: RangoFechas
    ubicacionId: string
}

export default function DesperdicioSection({ rango, ubicacionId }: Props) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const params = new URLSearchParams({ desde: rango.desde.toISOString(), hasta: rango.hasta.toISOString(), ...(ubicacionId && { ubicacionId }) })
                const res = await fetch(`/api/reportes/desperdicio?${params}`)
                if (res.ok) setData(await res.json())
            } catch (err) {
                console.error('Error fetching desperdicio:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [rango.desde.toISOString(), rango.hasta.toISOString(), ubicacionId])

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Calculando desperdicio...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos disponibles.</p></div>

    const k = data.kpis
    const deltaMerma = formatDelta(k.mermaActual, k.mermaAnterior, { invertColor: true })

    const productoColumns = [
        { key: 'nombre', label: 'Producto', sortable: true },
        { key: 'producidos', label: 'Producidos', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'rechazados', label: 'Rechazados', align: 'right' as const, sortable: true,
            format: (v: number) => <span style={{ color: v > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: 700 }}>{formatNumber(v)}</span>
        },
        { key: 'merma', label: '% Merma', align: 'right' as const, sortable: true,
            format: (v: number) => {
                const color = v > 5 ? 'var(--color-danger)' : v > 2 ? 'var(--color-warning)' : 'var(--color-success)'
                return <span style={{ color, fontWeight: 700 }}>{formatPercent(v)}</span>
            }
        },
        { key: 'costoDesperdicio', label: 'Costo Desp.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'motivos', label: 'Motivos', format: (v: string[]) => v?.length > 0 ? v.join(', ') : '—' },
    ]

    const entregaColumns = [
        { key: 'fecha', label: 'Fecha', sortable: true, format: (v: string) => new Date(v).toLocaleDateString('es-AR') },
        { key: 'cliente', label: 'Cliente', sortable: true },
        { key: 'zona', label: 'Zona', sortable: true },
        { key: 'unidades', label: 'Uds. Rech.', align: 'right' as const, sortable: true,
            format: (v: number) => <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{formatNumber(v)}</span>
        },
        { key: 'motivo', label: 'Motivo' },
    ]

    return (
        <div className="fade-in">
            {/* KPIs */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                <KpiCardEnhanced
                    label="% Merma Producción"
                    value={formatPercent(k.mermaActual)}
                    icon="📉"
                    color={k.mermaActual > 5 ? 'var(--color-danger)' : k.mermaActual > 2 ? 'var(--color-warning)' : 'var(--color-success)'}
                    delta={deltaMerma}
                    previousLabel="período ant."
                />
                <KpiCardEnhanced
                    label="Rechazos Producción"
                    value={formatNumber(k.totalRechazadosProduccion)}
                    icon="🏭"
                    color="var(--color-danger)"
                    footer={`de ${formatNumber(k.totalProducidos)} producidos`}
                />
                <KpiCardEnhanced
                    label="Rechazos en Entrega"
                    value={formatNumber(k.totalRechazadosEntrega)}
                    icon="🚚"
                    color="var(--color-warning)"
                />
                <KpiCardEnhanced
                    label="Costo del Desperdicio"
                    value={formatCurrency(k.costoDesperdicioTotal)}
                    icon="💸"
                    color="var(--color-danger)"
                    footer="Estimado s/ ficha técnica"
                />
            </div>

            {/* Charts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)'
            }}>
                {/* Tendencia de merma semanal */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <TrendChart
                        title="Tendencia de Merma Semanal"
                        type="line"
                        labels={data.tendencia.map((t: any) => t.label)}
                        datasets={[
                            {
                                label: '% Merma',
                                data: data.tendencia.map((t: any) => t.merma),
                                color: '#E74C3C',
                                type: 'line',
                                fill: true
                            }
                        ]}
                        formatTooltip={(v: number) => formatPercent(v)}
                    />
                </div>

                {/* Ranking de merma por producto */}
                {data.rankingProductos.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Rechazos por Producto"
                            labels={data.rankingProductos.slice(0, 8).map((p: any) => p.nombre)}
                            datasets={[{
                                label: 'Rechazados (paq.)',
                                data: data.rankingProductos.slice(0, 8).map((p: any) => p.rechazados),
                                color: '#E74C3C'
                            }]}
                            showLegend={false}
                        />
                    </div>
                )}
            </div>

            {/* Tables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* Ranking producción */}
                {data.rankingProductos.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{
                            fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                            marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                            letterSpacing: '0.03em'
                        }}>
                            Detalle de Merma por Producto
                        </h3>
                        <DataTable
                            columns={productoColumns}
                            data={data.rankingProductos}
                            showTotals={true}
                            totalColumns={['producidos', 'rechazados', 'costoDesperdicio']}
                            exportFilename={`Desperdicio_Productos_${rango.label.replace(/\s+/g, "_")}`}
                        />
                    </div>
                )}

                {/* Rechazos en entrega */}
                {data.rechazosEntrega.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{
                            fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                            marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                            letterSpacing: '0.03em'
                        }}>
                            Rechazos en Entrega
                        </h3>
                        <DataTable
                            columns={entregaColumns}
                            data={data.rechazosEntrega}
                            showTotals={true}
                            totalColumns={['unidades']}
                            exportFilename={`Desperdicio_Entregas_${rango.label.replace(/\s+/g, "_")}`}
                        />
                    </div>
                )}

                {data.rankingProductos.length === 0 && data.rechazosEntrega.length === 0 && (
                    <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>✅</div>
                        <p style={{ color: 'var(--color-success)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                            Sin rechazos registrados este período
                        </p>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: 'var(--text-sm)' }}>
                            No se detectaron rechazos en producción ni en entregas.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
