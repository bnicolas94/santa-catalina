'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { RangoFechas } from '../utils/dateUtils'
import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import DataTable from '../components/DataTable'
import { formatCurrency, formatPercent, formatNumber, formatDelta, formatCurrencyDecimals, formatDate, formatDecimal } from '../utils/formatters'

interface Props {
    rango: RangoFechas
    ubicacionId: string
    incluirTodo?: boolean
}

type SubTab = 'resumen' | 'insumos' | 'proveedores' | 'compras' | 'margenes'

export default function CostosSection({ rango, ubicacionId, incluirTodo = false }: Props) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [subTab, setSubTab] = useState<SubTab>('resumen')
    const [filtroInsumo, setFiltroInsumo] = useState('')

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

    const subTabs: { key: SubTab; label: string; icon: string }[] = [
        { key: 'resumen', label: 'Resumen', icon: '📊' },
        { key: 'insumos', label: 'Insumos', icon: '🥩' },
        { key: 'proveedores', label: 'Proveedores', icon: '🏪' },
        { key: 'compras', label: 'Facturas/Remitos', icon: '🧾' },
        { key: 'margenes', label: 'Márgenes', icon: '📈' },
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
                    icon="🥩"
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
                    label="Margen Prom."
                    value={formatPercent(k.margenPromedioProductos)}
                    icon="📈"
                    color={k.margenPromedioProductos >= 30 ? 'var(--color-success)' : 'var(--color-warning)'}
                />
                <KpiCardEnhanced
                    label="Facturas/Remitos"
                    value={formatNumber(k.totalCompras)}
                    icon="🧾"
                    color="var(--color-secondary)"
                    footer={`${formatNumber(k.totalProveedores)} proveedores`}
                />
            </div>

            {/* Sub-tabs */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-1)',
                marginBottom: 'var(--space-6)',
                overflowX: 'auto',
                paddingBottom: 'var(--space-2)'
            }}>
                {subTabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`btn btn-sm ${subTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setSubTab(tab.key)}
                        style={{
                            whiteSpace: 'nowrap',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--text-xs)',
                            padding: '6px 14px',
                            fontWeight: subTab === tab.key ? 700 : 400,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Content por sub-tab */}
            {subTab === 'resumen' && <ResumenView data={data} rango={rango} />}
            {subTab === 'insumos' && <InsumosView data={data} rango={rango} filtro={filtroInsumo} onFiltroChange={setFiltroInsumo} />}
            {subTab === 'proveedores' && <ProveedoresView data={data} rango={rango} />}
            {subTab === 'compras' && <ComprasView data={data} rango={rango} filtro={filtroInsumo} onFiltroChange={setFiltroInsumo} />}
            {subTab === 'margenes' && <MargenesView data={data} rango={rango} />}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB: RESUMEN
// ═══════════════════════════════════════════════════════════════
function ResumenView({ data, rango }: { data: any; rango: RangoFechas }) {
    const gastoCatColumns = [
        { key: 'nombre', label: 'Categoría', sortable: true },
        { key: 'count', label: 'Registros', align: 'right' as const, sortable: true },
        { key: 'monto', label: 'Monto Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
    ]

    return (
        <>
            {/* Charts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)'
            }}>
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

            {/* Tabla gastos por categoría */}
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
        </>
    )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB: INSUMOS (Desglose completo por insumo)
// ═══════════════════════════════════════════════════════════════
function InsumosView({ data, rango, filtro, onFiltroChange }: { data: any; rango: RangoFechas; filtro: string; onFiltroChange: (v: string) => void }) {
    const filteredInsumos = useMemo(() => {
        if (!filtro) return data.rankingInsumos
        const lower = filtro.toLowerCase()
        return data.rankingInsumos.filter((i: any) =>
            i.nombre.toLowerCase().includes(lower) ||
            i.familia.toLowerCase().includes(lower)
        )
    }, [data.rankingInsumos, filtro])

    const totalInsumos = data.rankingInsumos.reduce((acc: number, i: any) => acc + i.costoTotal, 0)

    const insumoColumns = [
        { key: 'nombre', label: 'Insumo', sortable: true },
        { key: 'familia', label: 'Familia', sortable: true, width: '100px' },
        { key: 'cantidadComprada', label: 'Cantidad', align: 'right' as const, sortable: true, format: (v: number) => formatDecimal(v, 1) },
        { key: 'unidad', label: 'Ud.', width: '50px' },
        { key: 'compras', label: 'FC/Rem.', align: 'right' as const, sortable: true },
        { key: 'precioPromedio', label: '$/Ud. Prom.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'costoTotal', label: 'Costo Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        {
            key: 'participacion', label: '% Part.', align: 'right' as const, sortable: true,
            format: (_v: number, row: any) => {
                const pct = totalInsumos > 0 ? (row.costoTotal / totalInsumos) * 100 : 0
                return formatPercent(pct)
            }
        }
    ]

    return (
        <>
            {/* Gráfico de distribución */}
            {data.rankingInsumos.length > 0 && (
                <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                    <TrendChart
                        title="Distribución de Costos por Insumo"
                        labels={data.rankingInsumos.slice(0, 12).map((i: any) => i.nombre)}
                        datasets={[{
                            label: 'Costo',
                            data: data.rankingInsumos.slice(0, 12).map((i: any) => i.costoTotal)
                        }]}
                        formatTooltip={(v: number) => formatCurrency(v)}
                        showLegend={false}
                        height={250}
                    />
                </div>
            )}

            {/* Tabla completa de insumos */}
            <div className="card" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                        fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', margin: 0
                    }}>
                        Desglose Completo por Insumo
                    </h3>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Buscar insumo o familia..."
                        value={filtro}
                        onChange={e => onFiltroChange(e.target.value)}
                        style={{ maxWidth: 260, fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                    />
                </div>
                <DataTable
                    columns={insumoColumns}
                    data={filteredInsumos}
                    showTotals={true}
                    totalColumns={['costoTotal']}
                    exportFilename={`Costos_Insumos_Detalle_${rango.label.replace(/\s+/g, "_")}`}
                    maxHeight="500px"
                />
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB: PROVEEDORES
// ═══════════════════════════════════════════════════════════════
function ProveedoresView({ data, rango }: { data: any; rango: RangoFechas }) {
    const proveedorColumns = [
        { key: 'nombre', label: 'Proveedor', sortable: true },
        { key: 'compras', label: 'FC/Remitos', align: 'right' as const, sortable: true },
        { key: 'costoTotal', label: 'Total Facturado', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
    ]

    return (
        <>
            {data.gastoPorProveedor.length > 0 && (
                <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                    <TrendChart
                        title="Gasto por Proveedor"
                        labels={data.gastoPorProveedor.map((p: any) => p.nombre)}
                        datasets={[{
                            label: 'Total',
                            data: data.gastoPorProveedor.map((p: any) => p.costoTotal)
                        }]}
                        formatTooltip={(v: number) => formatCurrency(v)}
                        showLegend={false}
                    />
                </div>
            )}

            <div className="card" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{
                    fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                    marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.03em'
                }}>
                    Ranking de Proveedores
                </h3>
                <DataTable
                    columns={proveedorColumns}
                    data={data.gastoPorProveedor}
                    showTotals={true}
                    totalColumns={['costoTotal', 'compras']}
                    exportFilename={`Costos_Proveedores_${rango.label.replace(/\s+/g, "_")}`}
                    maxHeight="400px"
                />
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB: COMPRAS (Facturas/Remitos individuales)
// ═══════════════════════════════════════════════════════════════
function ComprasView({ data, rango, filtro, onFiltroChange }: { data: any; rango: RangoFechas; filtro: string; onFiltroChange: (v: string) => void }) {
    const filteredCompras = useMemo(() => {
        if (!filtro) return data.comprasDetalle
        const lower = filtro.toLowerCase()
        return data.comprasDetalle.filter((c: any) =>
            c.insumo.toLowerCase().includes(lower) ||
            c.proveedor.toLowerCase().includes(lower) ||
            c.factura.toLowerCase().includes(lower)
        )
    }, [data.comprasDetalle, filtro])

    const comprasColumns = [
        { key: 'fecha', label: 'Fecha', sortable: true, width: '90px', format: (v: string) => formatDate(v) },
        { key: 'insumo', label: 'Insumo', sortable: true },
        { key: 'cantidad', label: 'Cant.', align: 'right' as const, sortable: true, format: (v: number) => formatDecimal(v, 1) },
        { key: 'unidad', label: 'Ud.', width: '50px' },
        { key: 'precioUnitario', label: '$/Ud.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'costoTotal', label: 'Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'proveedor', label: 'Proveedor', sortable: true, width: '120px' },
        { key: 'factura', label: 'FC/Remito', sortable: true, width: '100px' },
    ]

    return (
        <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h3 style={{
                    fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                    fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', margin: 0
                }}>
                    Detalle de Facturas y Remitos
                </h3>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Buscar insumo, proveedor o factura..."
                    value={filtro}
                    onChange={e => onFiltroChange(e.target.value)}
                    style={{ maxWidth: 280, fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                />
            </div>
            <DataTable
                columns={comprasColumns}
                data={filteredCompras}
                showTotals={true}
                totalColumns={['costoTotal']}
                exportFilename={`Costos_Compras_Detalle_${rango.label.replace(/\s+/g, "_")}`}
                maxHeight="600px"
            />
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB: MÁRGENES (Análisis de margen por producto)
// ═══════════════════════════════════════════════════════════════
function MargenesView({ data, rango }: { data: any; rango: RangoFechas }) {
    const productoColumns = [
        { key: 'nombre', label: 'Producto', sortable: true },
        { key: 'costoUnitario', label: 'Costo/u', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'cantidadPresentacion', label: 'Cant.', align: 'right' as const, sortable: true },
        { key: 'precioVenta', label: 'Precio Vta.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'costoTotal', label: 'Costo Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'margenBruto', label: 'Margen $', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        {
            key: 'margenPct', label: 'Margen %', align: 'right' as const, sortable: true,
            format: (v: number) => {
                const color = v >= 40 ? 'var(--color-success)' : v >= 20 ? 'var(--color-warning)' : 'var(--color-danger)'
                return <span style={{ color, fontWeight: 700 }}>{formatPercent(v)}</span>
            }
        },
    ]

    return (
        <>
            {/* Gráfico de márgenes */}
            {data.costoPorProducto.length > 0 && (
                <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                    <TrendChart
                        title="Margen por Producto (%)"
                        labels={data.costoPorProducto.map((p: any) => p.nombre)}
                        datasets={[{
                            label: 'Margen %',
                            data: data.costoPorProducto.map((p: any) => p.margenPct),
                            color: '#2ECC71'
                        }]}
                        formatTooltip={(v: number) => formatPercent(v)}
                        showLegend={false}
                    />
                </div>
            )}

            {/* Tabla de márgenes */}
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
        </>
    )
}
