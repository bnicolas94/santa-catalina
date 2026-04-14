'use client'

import React, { useState, useEffect } from 'react'
import type { RangoFechas } from '../utils/dateUtils'
import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import DataTable from '../components/DataTable'
import { formatCurrency, formatPercent, formatNumber, formatDelta, formatCurrencyDecimals } from '../utils/formatters'

interface Props {
    rango: RangoFechas
    ubicacionId: string
    incluirTodo?: boolean
}

export default function CostosSection({ rango, ubicacionId, incluirTodo = false }: Props) {
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
                const res = await fetch(`/api/reportes/costos?${params}`)
                if (res.ok) setData(await res.json())
            } catch (err) {
                console.error('Error fetching costos:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [rango.desde.toISOString(), rango.hasta.toISOString(), ubicacionId, incluirTodo])

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Calculando costos...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos disponibles.</p></div>

    const k = data.kpis
    const deltaCostoTotal = formatDelta(k.costoTotal, k.costoTotalAnterior, { invertColor: true })
    const deltaInsumos = formatDelta(k.costoInsumosActual, k.costoInsumosAnterior, { invertColor: true })
    const deltaGastos = formatDelta(k.gastosTotalActual, k.gastosTotalAnterior, { invertColor: true })

    // Columnas de productos con margen
    const productoColumns = [
        { key: 'nombre', label: 'Producto', sortable: true },
        { key: 'costoUnitario', label: 'Costo/u', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'cantidadPresentacion', label: 'Cant.', align: 'right' as const, sortable: true },
        { key: 'precioVenta', label: 'Precio Vta.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'costoTotal', label: 'Costo Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        {
            key: 'margenPct', label: 'Margen %', align: 'right' as const, sortable: true,
            format: (v: number) => {
                const color = v >= 40 ? 'var(--color-success)' : v >= 20 ? 'var(--color-warning)' : 'var(--color-danger)'
                return <span style={{ color, fontWeight: 700 }}>{formatPercent(v)}</span>
            }
        },
    ]

    // Columnas de ranking insumos
    const insumoColumns = [
        { key: 'nombre', label: 'Insumo', sortable: true },
        { key: 'cantidadComprada', label: 'Cantidad', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'unidad', label: 'Unidad', width: '60px' },
        { key: 'compras', label: 'Compras', align: 'right' as const, sortable: true },
        { key: 'costoTotal', label: 'Costo Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
    ]

    // Columnas de gastos por categoría
    const gastoCatColumns = [
        { key: 'nombre', label: 'Categoría', sortable: true },
        { key: 'count', label: 'Registros', align: 'right' as const, sortable: true },
        { key: 'monto', label: 'Monto Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
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
                    label="Costo Total"
                    value={formatCurrency(k.costoTotal)}
                    icon="💸"
                    color="var(--color-danger)"
                    delta={deltaCostoTotal}
                    previousLabel="período ant."
                />
                <KpiCardEnhanced
                    label="Compra Insumos"
                    value={formatCurrency(k.costoInsumosActual)}
                    icon="📦"
                    color="var(--color-warning)"
                    delta={deltaInsumos}
                    previousLabel="período ant."
                />
                <KpiCardEnhanced
                    label="Gastos Operativos"
                    value={formatCurrency(k.gastosTotalActual)}
                    icon="🏭"
                    color="var(--color-info)"
                    delta={deltaGastos}
                    previousLabel="período ant."
                />
                <KpiCardEnhanced
                    label="Margen Prom. Productos"
                    value={formatPercent(k.margenPromedioProductos)}
                    icon="📊"
                    color={k.margenPromedioProductos >= 30 ? 'var(--color-success)' : 'var(--color-warning)'}
                />
            </div>

            {/* Charts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)'
            }}>
                {/* Evolución de costos */}
                {data.evolucion.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Evolución de Costos (6 periodos)"
                            type="bar"
                            stacked={true}
                            labels={data.evolucion.map((e: any) => e.label)}
                            datasets={[
                                { label: 'Insumos', data: data.evolucion.map((e: any) => e.insumos), color: '#F39C12' },
                                { label: 'Gastos Op.', data: data.evolucion.map((e: any) => e.gastos), color: '#E74C3C' }
                            ]}
                            formatTooltip={(v: number) => formatCurrency(v)}
                        />
                    </div>
                )}

                {/* Gastos por categoría */}
                {data.gastosPorCategoria.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Gastos por Categoría"
                            labels={data.gastosPorCategoria.map((g: any) => g.nombre)}
                            datasets={[{
                                label: 'Monto',
                                data: data.gastosPorCategoria.map((g: any) => g.monto)
                            }]}
                            formatTooltip={(v: number) => formatCurrency(v)}
                            showLegend={false}
                        />
                    </div>
                )}
            </div>

            {/* Tablas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* Margen por producto */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                        marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.03em'
                    }}>
                        Análisis de Margen por Producto
                    </h3>
                    <DataTable
                        columns={productoColumns}
                        data={data.costoPorProducto}
                        exportFilename={`Costos_Margen_${rango.label.replace(/\s+/g, "_")}`}
                        maxHeight="400px"
                    />
                </div>

                {/* Dos tablas lado a lado */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: 'var(--space-6)'
                }}>
                    {/* Top insumos */}
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{
                            fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                            marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                            letterSpacing: '0.03em'
                        }}>
                            Top 10 Insumos por Costo
                        </h3>
                        <DataTable
                            columns={insumoColumns}
                            data={data.rankingInsumos}
                            showTotals={true}
                            totalColumns={['costoTotal']}
                            exportFilename={`Costos_Insumos_${rango.label.replace(/\s+/g, "_")}`}
                            maxHeight="300px"
                        />
                    </div>

                    {/* Gastos por categoría */}
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{
                            fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                            marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                            letterSpacing: '0.03em'
                        }}>
                            Gastos por Categoría
                        </h3>
                        <DataTable
                            columns={gastoCatColumns}
                            data={data.gastosPorCategoria}
                            showTotals={true}
                            totalColumns={['monto', 'count']}
                            exportFilename={`Costos_Gastos_${rango.label.replace(/\s+/g, "_")}`}
                            maxHeight="300px"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
