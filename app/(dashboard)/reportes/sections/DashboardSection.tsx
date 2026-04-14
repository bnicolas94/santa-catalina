'use client'

import React, { useState, useEffect } from 'react'
import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import AlertBanner from '../components/AlertBanner'
import type { Alerta } from '../components/AlertBanner'
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters'

interface DashboardSectionProps {
    mes: string
    anio: string
    ubicacionId: string
    rentabilidadData: any
    produccionData: any
    loading: boolean
    onDrillDown: (tipo: string, label: string) => void
}

export default function DashboardSection({
    mes, anio, ubicacionId,
    rentabilidadData, produccionData,
    loading,
    onDrillDown
}: DashboardSectionProps) {
    const [alertas, setAlertas] = useState<Alerta[]>([])
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

    useEffect(() => {
        async function fetchAlertas() {
            try {
                const params = new URLSearchParams({ mes, anio, ...(ubicacionId && { ubicacionId }) })
                const res = await fetch(`/api/reportes/alertas?${params}`)
                if (res.ok) {
                    const data = await res.json()
                    setAlertas(data)
                }
            } catch (err) {
                console.error('Error fetching alertas:', err)
            }
        }
        fetchAlertas()
    }, [mes, anio, ubicacionId])

    if (loading && !rentabilidadData && !produccionData) {
        return <div className="empty-state"><div className="spinner" /><p>Cargando dashboard...</p></div>
    }

    const r = rentabilidadData
    const p = produccionData
    const alertasVisibles = alertas.filter(a => !dismissedAlerts.has(a.id))

    return (
        <div className="fade-in">
            {/* Alertas */}
            <AlertBanner
                alertas={alertasVisibles}
                onDismiss={(id) => setDismissedAlerts(prev => new Set(prev).add(id))}
            />

            {/* KPI Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                <KpiCardEnhanced
                    label="Ingresos Brutos"
                    value={r ? formatCurrency(r.ingresosTotales) : '—'}
                    icon="💰"
                    color="var(--color-info)"
                    loading={loading && !r}
                    onClick={() => onDrillDown('pedidos', 'Ingresos Brutos')}
                />
                <KpiCardEnhanced
                    label="CMV"
                    value={r ? formatCurrency(r.costoMercaderiaVendida) : '—'}
                    icon="📦"
                    color="var(--color-warning)"
                    loading={loading && !r}
                />
                <KpiCardEnhanced
                    label="Gastos Operativos"
                    value={r ? formatCurrency(r.totalGastos) : '—'}
                    icon="💸"
                    color="var(--color-danger)"
                    loading={loading && !r}
                    onClick={() => onDrillDown('gastos', 'Gastos Operativos')}
                />
                <KpiCardEnhanced
                    label="Margen EBITDA"
                    value={r ? formatPercent(r.margenEbitda) : '—'}
                    icon="📈"
                    color={r && r.margenEbitda >= 15 ? 'var(--color-success)' : 'var(--color-warning)'}
                    loading={loading && !r}
                />
                <KpiCardEnhanced
                    label="Producción (Paq.)"
                    value={p ? formatNumber(p.globales.totalPaquetes) : '—'}
                    icon="🏭"
                    color="var(--color-primary)"
                    loading={loading && !p}
                    onClick={() => onDrillDown('lotes', 'Producción del Mes')}
                />
                <KpiCardEnhanced
                    label="Merma %"
                    value={p && p.globales.totalPaquetes > 0
                        ? formatPercent((p.globales.totalRechazados / p.globales.totalPaquetes) * 100)
                        : '0%'
                    }
                    icon="🗑️"
                    color={p && (p.globales.totalRechazados / (p.globales.totalPaquetes || 1)) * 100 > 5
                        ? 'var(--color-danger)' : 'var(--color-success)'}
                    loading={loading && !p}
                />
            </div>

            {/* Charts Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)'
            }}>
                {/* Cascada de Resultados */}
                {r && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Cascada de Resultados"
                            labels={[`${mes}/${anio}`]}
                            datasets={[
                                { label: 'Facturación', data: [r.ingresosTotales], color: '#3498DB' },
                                { label: 'CMV', data: [r.costoMercaderiaVendida], color: '#F39C12' },
                                { label: 'Gastos', data: [r.totalGastos], color: '#E74C3C' },
                                {
                                    label: 'EBITDA',
                                    data: [r.rentabilidadNeta],
                                    color: r.rentabilidadNeta >= 0 ? '#2ECC71' : '#E74C3C'
                                }
                            ]}
                            formatTooltip={(v: number) => formatCurrency(v)}
                        />
                    </div>
                )}

                {/* Distribución de Gastos */}
                {r && Object.keys(r.gastosPorCategoria).length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Gastos por Categoría"
                            labels={Object.keys(r.gastosPorCategoria)}
                            datasets={[{
                                label: 'Monto',
                                data: Object.values(r.gastosPorCategoria) as number[]
                            }]}
                            formatTooltip={(v: number) => formatCurrency(v)}
                            showLegend={false}
                        />
                    </div>
                )}

                {/* Tendencia Producción */}
                {p && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Tendencia de Producción (Paquetes)"
                            labels={p.tendencia.map((t: any) => t.semana)}
                            datasets={[{
                                label: 'Paquetes',
                                data: p.tendencia.map((t: any) => t.paquetes),
                                color: '#3498DB'
                            }]}
                        />
                    </div>
                )}

                {/* Top Productos */}
                {p && p.desglose.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-gray-600)',
                            marginBottom: 'var(--space-4)',
                            fontFamily: 'var(--font-heading)',
                            letterSpacing: '0.03em'
                        }}>
                            Top 5 Productos por Producción
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {p.desglose.slice(0, 5).map((item: any, i: number) => {
                                const maxPaq = p.desglose[0].paquetes || 1
                                const pct = (item.paquetes / maxPaq) * 100
                                return (
                                    <div key={i}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: 'var(--text-sm)',
                                            marginBottom: 'var(--space-1)'
                                        }}>
                                            <span style={{ fontWeight: 500 }}>{item.nombre}</span>
                                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-ui)' }}>
                                                {formatNumber(item.paquetes)} paq.
                                            </span>
                                        </div>
                                        <div style={{
                                            height: 6,
                                            backgroundColor: 'var(--color-gray-100)',
                                            borderRadius: 3,
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${pct}%`,
                                                backgroundColor: 'var(--color-primary)',
                                                borderRadius: 3,
                                                transition: 'width 0.5s ease'
                                            }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
