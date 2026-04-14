'use client'

import React, { useState, useEffect } from 'react'
import type { RangoFechas } from '../utils/dateUtils'
import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import DataTable from '../components/DataTable'
import { formatNumber, formatPercent, formatDecimal } from '../utils/formatters'

interface Props {
    rango: RangoFechas
    ubicacionId: string
    incluirTodo?: boolean
}

export default function PerformanceSection({ rango, ubicacionId, incluirTodo = false }: Props) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const params = new URLSearchParams({ 
                    desde: rango.desde.toISOString(), 
                    hasta: rango.hasta.toISOString(), 
                    ...(ubicacionId && { ubicacionId }),
                    ...(incluirTodo && { todos: 'true' })
                })
                const res = await fetch(`/api/reportes/performance?${params}`)
                if (res.ok) setData(await res.json())
            } catch (err) {
                console.error('Error fetching performance:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [rango.desde.toISOString(), rango.hasta.toISOString(), ubicacionId, incluirTodo])

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Calculando performance...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos disponibles.</p></div>

    const k = data.kpis

    const coordColumns = [
        { key: 'nombre', label: 'Coordinador', sortable: true },
        { key: 'lotes', label: 'Lotes', align: 'right' as const, sortable: true },
        { key: 'paquetes', label: 'Paquetes', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'rechazados', label: 'Rechazos', align: 'right' as const, sortable: true,
            format: (v: number) => v > 0 ? <span style={{ color: 'var(--color-danger)' }}>{formatNumber(v)}</span> : '0'
        },
        { key: 'merma', label: '% Merma', align: 'right' as const, sortable: true,
            format: (v: number) => {
                const color = v > 5 ? 'var(--color-danger)' : v > 2 ? 'var(--color-warning)' : 'var(--color-success)'
                return <span style={{ color, fontWeight: 600 }}>{formatPercent(v)}</span>
            }
        },
    ]

    const choferColumns = [
        { key: 'nombre', label: 'Chofer', sortable: true },
        { key: 'rutas', label: 'Rutas', align: 'right' as const, sortable: true },
        { key: 'entregas', label: 'Entregas', align: 'right' as const, sortable: true },
        { key: 'cumplimiento', label: '% Cumpl.', align: 'right' as const, sortable: true,
            format: (v: number) => {
                const color = v >= 90 ? 'var(--color-success)' : v >= 70 ? 'var(--color-warning)' : 'var(--color-danger)'
                return <span style={{ color, fontWeight: 600 }}>{formatPercent(v)}</span>
            }
        },
        { key: 'km', label: 'Km', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'kmPorEntrega', label: 'Km/Entrega', align: 'right' as const, sortable: true, format: (v: number) => formatDecimal(v, 1) },
    ]

    return (
        <div className="fade-in">
            {/* KPIs */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                <KpiCardEnhanced
                    label="Lotes Producidos"
                    value={formatNumber(k.totalLotes)}
                    icon="🏭"
                    color="var(--color-primary)"
                />
                <KpiCardEnhanced
                    label="Paquetes Totales"
                    value={formatNumber(k.totalPaquetes)}
                    icon="📦"
                    color="var(--color-info)"
                />
                <KpiCardEnhanced
                    label="% Cumpl. Entregas"
                    value={formatPercent(k.cumplimientoEntregas)}
                    icon="✅"
                    color={k.cumplimientoEntregas >= 90 ? 'var(--color-success)' : 'var(--color-warning)'}
                    footer={`${formatNumber(k.totalEntregas)} entregas en ${formatNumber(k.totalRutas)} rutas`}
                />
                <KpiCardEnhanced
                    label="Eficiencia Logística"
                    value={`${formatDecimal(k.eficienciaKm, 1)} km/ent`}
                    icon="🚚"
                    color="var(--color-secondary)"
                    footer={`${formatNumber(k.kmTotales)} km totales`}
                />
            </div>

            {/* Charts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)'
            }}>
                {/* Producción por día de la semana */}
                {data.produccionDiaSemana.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Producción por Día de la Semana"
                            labels={data.produccionDiaSemana.map((d: any) => d.dia)}
                            datasets={[{
                                label: 'Paquetes',
                                data: data.produccionDiaSemana.map((d: any) => d.producidos),
                                color: '#3498DB'
                            }]}
                            showLegend={false}
                        />
                    </div>
                )}

                {/* Coordinadores chart */}
                {data.rankingCoordinadores.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Producción por Coordinador"
                            labels={data.rankingCoordinadores.map((c: any) => c.nombre)}
                            datasets={[{
                                label: 'Paquetes',
                                data: data.rankingCoordinadores.map((c: any) => c.paquetes),
                                color: '#2ECC71'
                            }]}
                            showLegend={false}
                        />
                    </div>
                )}
            </div>

            {/* Tables */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
                gap: 'var(--space-6)'
            }}>
                {/* Coordinadores */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                        marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.03em'
                    }}>
                        Ranking de Coordinadores
                    </h3>
                    <DataTable
                        columns={coordColumns}
                        data={data.rankingCoordinadores}
                        showTotals={true}
                        totalColumns={['lotes', 'paquetes', 'rechazados']}
                        exportFilename={`Performance_Coordinadores_${rango.label.replace(/\s+/g, "_")}`}
                        maxHeight="350px"
                    />
                </div>

                {/* Choferes */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                        marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.03em'
                    }}>
                        Ranking de Choferes
                    </h3>
                    <DataTable
                        columns={choferColumns}
                        data={data.rankingChoferes}
                        showTotals={true}
                        totalColumns={['rutas', 'entregas', 'km']}
                        exportFilename={`Performance_Choferes_${rango.label.replace(/\s+/g, "_")}`}
                        maxHeight="350px"
                    />
                </div>
            </div>
        </div>
    )
}
