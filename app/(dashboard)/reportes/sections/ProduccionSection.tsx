'use client'

import React from 'react'
import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import DataTable from '../components/DataTable'
import { formatNumber } from '../utils/formatters'

interface Props {
    data: any
    loading: boolean
    userPrefs: any
    onDrillDown: (tipo: string, label: string) => void
}

export default function ProduccionSection({ data, loading, userPrefs, onDrillDown }: Props) {
    if (loading && !data) return <div className="empty-state"><div className="spinner" /><p>Calculando producción...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos disponibles para el periodo seleccionado.</p></div>

    const columns = [
        { key: 'nombre', label: 'Producto', sortable: true },
        { key: 'codigo', label: 'Código', sortable: true, width: '100px' },
        ...(userPrefs.showProdPaquetes ? [{ key: 'paquetes', label: 'Paquetes', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) }] : []),
        ...(userPrefs.showProdPlanchas ? [{ key: 'planchas', label: 'Planchas', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) }] : []),
        ...(userPrefs.showProdSanguchitos ? [{ key: 'sanguchitos', label: 'Sanguchitos', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) }] : []),
        ...(userPrefs.showProdRechazados ? [{ key: 'rechazados', label: 'Rechazos', align: 'right' as const, sortable: true, format: (v: number) => v > 0 ? `⚠ ${formatNumber(v)}` : '0' }] : []),
    ]

    const totalCols = []
    if (userPrefs.showProdPaquetes) totalCols.push('paquetes')
    if (userPrefs.showProdPlanchas) totalCols.push('planchas')
    if (userPrefs.showProdSanguchitos) totalCols.push('sanguchitos')
    if (userPrefs.showProdRechazados) totalCols.push('rechazados')

    return (
        <div className="fade-in">
            {/* KPIs */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                {userPrefs.showProdPaquetes && (
                    <KpiCardEnhanced
                        label="Total Paquetes"
                        value={formatNumber(data.globales.totalPaquetes)}
                        icon="📦"
                        color="var(--color-primary)"
                        onClick={() => onDrillDown('lotes', 'Detalle de Lotes')}
                    />
                )}
                {userPrefs.showProdPlanchas && (
                    <KpiCardEnhanced
                        label="Total Planchas"
                        value={formatNumber(data.globales.totalPlanchas)}
                        icon="🔲"
                        color="var(--color-secondary)"
                    />
                )}
                {userPrefs.showProdSanguchitos && (
                    <KpiCardEnhanced
                        label="Total Sanguchitos"
                        value={formatNumber(data.globales.totalSanguchitos)}
                        icon="🥪"
                        color="var(--color-success)"
                    />
                )}
                {userPrefs.showProdRechazados && (
                    <KpiCardEnhanced
                        label="Merma / Rechazos"
                        value={formatNumber(data.globales.totalRechazados)}
                        icon="🗑️"
                        color="var(--color-danger)"
                        footer={data.globales.totalPaquetes > 0
                            ? `${((data.globales.totalRechazados / data.globales.totalPaquetes) * 100).toFixed(1)}% del total`
                            : undefined
                        }
                    />
                )}
                <KpiCardEnhanced
                    label="Total Lotes"
                    value={formatNumber(data.globales.totalLotes)}
                    icon="🏭"
                    color="var(--color-info)"
                />
            </div>

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
                        title="Tendencia Semanal"
                        labels={data.tendencia.map((t: any) => t.semana)}
                        datasets={[{
                            label: 'Paquetes Producidos',
                            data: data.tendencia.map((t: any) => t.paquetes),
                            color: '#3498DB'
                        }]}
                    />
                </div>

                {/* Desglose por producto */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <TrendChart
                        title="Producción por Producto"
                        labels={data.desglose.slice(0, 8).map((d: any) => d.nombre)}
                        datasets={[{
                            label: 'Paquetes',
                            data: data.desglose.slice(0, 8).map((d: any) => d.paquetes),
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
                    Desglose por Producto
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
