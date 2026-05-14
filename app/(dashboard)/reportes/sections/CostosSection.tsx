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

type SubTab = 'resumen' | 'insumos' | 'gastos' | 'proveedores' | 'compras' | 'margenes'

export default function CostosSection({ rango, ubicacionId, incluirTodo = false }: Props) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [subTab, setSubTab] = useState<SubTab>('resumen')
    const [filtroInsumo, setFiltroInsumo] = useState('')
    
    // Drill-down states
    const [insumoSeleccionado, setInsumoSeleccionado] = useState('')
    const [proveedorSeleccionado, setProveedorSeleccionado] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
    
    // Conceptos de caja a incluir/excluir
    const [conceptosExcluidos, setConceptosExcluidos] = useState<string[]>([])

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
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                    // Resetear exclusiones al cambiar de periodo/ubicación si se desea
                    // setConceptosExcluidos([]) 
                }
            } catch (err) {
                console.error('Error fetching costos:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [rango.desde.toISOString(), rango.hasta.toISOString(), ubicacionId, incluirTodo])

    // Extraer conceptos de caja disponibles en el periodo
    const availableCajaConcepts = useMemo(() => {
        if (!data) return []
        const concepts = new Set<string>()
        data.gastosDetalle.forEach((g: any) => {
            if (g.origen === 'caja') {
                concepts.add(g.categoria.replace('Caja: ', ''))
            }
        })
        return Array.from(concepts).sort()
    }, [data])

    // Procesar datos filtrando por conceptos excluidos
    const processedData = useMemo(() => {
        if (!data) return null

        // 1. Filtrar detalle de gastos
        const filteredGastosDetalle = data.gastosDetalle.filter((g: any) => {
            if (g.origen !== 'caja') return true
            const concepto = g.categoria.replace('Caja: ', '')
            return !conceptosExcluidos.includes(concepto)
        })

        // 2. Recalcular Gastos por Categoría
        const gCat: Record<string, { nombre: string; monto: number; count: number }> = {}
        filteredGastosDetalle.forEach((g: any) => {
            if (!gCat[g.categoria]) gCat[g.categoria] = { nombre: g.categoria, monto: 0, count: 0 }
            gCat[g.categoria].monto += g.monto
            gCat[g.categoria].count++
        })

        // 3. Recalcular KPIs
        const gastosTotalActual = filteredGastosDetalle.reduce((acc: number, g: any) => acc + g.monto, 0)
        const costoTotal = data.kpis.costoInsumosActual + gastosTotalActual
        const gananciaActual = data.kpis.ventasTotalActual - costoTotal
        const margenReal = data.kpis.ventasTotalActual > 0 ? (gananciaActual / data.kpis.ventasTotalActual) * 100 : 0

        return {
            ...data,
            gastosDetalle: filteredGastosDetalle,
            gastosPorCategoria: Object.values(gCat).sort((a: any, b: any) => b.monto - a.monto),
            kpis: {
                ...data.kpis,
                gastosTotalActual,
                costoTotal,
                gananciaActual,
                margenReal
            }
        }
    }, [data, conceptosExcluidos])

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Calculando costos...</p></div>
    if (!data || !processedData) return <div className="empty-state"><p>No hay datos disponibles.</p></div>

    const k = processedData.kpis
    const deltaCostoTotal = formatDelta(k.costoTotal, data.kpis.costoTotalAnterior, { invertColor: true })
    const deltaInsumos = formatDelta(k.costoInsumosActual, data.kpis.costoInsumosAnterior, { invertColor: true })
    const deltaGastos = formatDelta(k.gastosTotalActual, data.kpis.gastosTotalAnterior, { invertColor: true })
    const deltaGanancia = formatDelta(k.gananciaActual, data.kpis.gananciaAnterior)
    const deltaVentas = formatDelta(k.ventasTotalActual, data.kpis.ventasTotalAnterior)

    const esGanancia = k.gananciaActual >= 0

    const subTabs: { key: SubTab; label: string; icon: string }[] = [
        { key: 'resumen', label: 'Resumen', icon: '📊' },
        { key: 'insumos', label: 'Insumos', icon: '🍎' },
        { key: 'gastos', label: 'Gastos Op.', icon: '💸' },
        { key: 'proveedores', label: 'Proveedores', icon: '🏪' },
        { key: 'compras', label: 'Facturas/Remitos', icon: '🧾' },
        { key: 'margenes', label: 'Resultado', icon: '📈' },
    ]

    function handleSelectCategory(cat: string) {
        setCategoriaSeleccionada(cat)
        setSubTab('gastos')
    }

    function toggleConcept(concept: string) {
        setConceptosExcluidos(prev => 
            prev.includes(concept) 
                ? prev.filter(c => c !== concept) 
                : [...prev, concept]
        )
    }

    return (
        <div className="fade-in">
            {/* Control de conceptos de caja (solo si hay conceptos) */}
            {availableCajaConcepts.length > 0 && (
                <div className="card" style={{ 
                    padding: 'var(--space-4) var(--space-6)', 
                    marginBottom: 'var(--space-6)',
                    backgroundColor: 'var(--color-primary-50)',
                    border: '1px dashed var(--color-primary-200)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-6)',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '18px' }}>⚙️</span>
                        <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary-700)', margin: 0 }}>
                            Configurar Egresos de Caja
                        </h4>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        {availableCajaConcepts.map(concept => {
                            const isExcluded = conceptosExcluidos.includes(concept)
                            return (
                                <label 
                                    key={concept} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 'var(--space-2)', 
                                        fontSize: 'var(--text-xs)', 
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: isExcluded ? 'var(--color-gray-100)' : 'white',
                                        border: `1px solid ${isExcluded ? 'var(--color-gray-200)' : 'var(--color-primary-200)'}`,
                                        opacity: isExcluded ? 0.7 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={!isExcluded} 
                                        onChange={() => toggleConcept(concept)}
                                    />
                                    <span style={{ fontWeight: isExcluded ? 400 : 600 }}>{concept}</span>
                                </label>
                            )
                        })}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', maxWidth: 200 }}>
                        Deselecciona conceptos que ya estén registrados manualmente para evitar duplicar costos.
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                <KpiCardEnhanced
                    label="Ventas"
                    value={formatCurrency(k.ventasTotalActual)}
                    icon="💰"
                    color="var(--color-success)"
                    delta={deltaVentas}
                    previousLabel="período ant."
                    onClick={() => setSubTab('margenes')}
                />
                <KpiCardEnhanced
                    label="Costo Total"
                    value={formatCurrency(k.costoTotal)}
                    icon="📉"
                    color="var(--color-danger)"
                    delta={deltaCostoTotal}
                    previousLabel="período ant."
                    onClick={() => setSubTab('resumen')}
                />
                <KpiCardEnhanced
                    label={esGanancia ? 'Ganancia' : 'Pérdida'}
                    value={formatCurrency(Math.abs(k.gananciaActual))}
                    icon={esGanancia ? '✅' : '🔻'}
                    color={esGanancia ? 'var(--color-success)' : 'var(--color-danger)'}
                    delta={deltaGanancia}
                    previousLabel="período ant."
                    footer={`Margen: ${formatPercent(k.margenReal)}`}
                    onClick={() => setSubTab('margenes')}
                />
                <KpiCardEnhanced
                    label="Compra Insumos"
                    value={formatCurrency(k.costoInsumosActual)}
                    icon="🍎"
                    color="var(--color-warning)"
                    delta={deltaInsumos}
                    previousLabel="período ant."
                    onClick={() => setSubTab('insumos')}
                />
                <KpiCardEnhanced
                    label="Gastos Operativos"
                    value={formatCurrency(k.gastosTotalActual)}
                    icon="💸"
                    color="var(--color-info)"
                    delta={deltaGastos}
                    previousLabel="período ant."
                    onClick={() => setSubTab('gastos')}
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

            {subTab === 'resumen' && <ResumenView data={processedData} rango={rango} onSelectCategory={handleSelectCategory} />}
            {subTab === 'insumos' && (
                <InsumosView 
                    data={processedData} 
                    rango={rango} 
                    filtro={filtroInsumo} 
                    onFiltroChange={setFiltroInsumo} 
                    seleccionado={insumoSeleccionado}
                    onSeleccionChange={setInsumoSeleccionado}
                />
            )}
            {subTab === 'gastos' && (
                <GastosDetalleView 
                    data={processedData} 
                    rango={rango} 
                    seleccionado={categoriaSeleccionada}
                    onSeleccionChange={setCategoriaSeleccionada}
                />
            )}
            {subTab === 'proveedores' && (
                <ProveedoresView 
                    data={processedData} 
                    rango={rango} 
                    seleccionado={proveedorSeleccionado}
                    onSeleccionChange={setProveedorSeleccionado}
                />
            )}
            {subTab === 'compras' && <ComprasView data={processedData} rango={rango} filtro={filtroInsumo} onFiltroChange={setFiltroInsumo} />}
            {subTab === 'margenes' && <MargenesView data={processedData} rango={rango} />}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB: RESUMEN
// ═══════════════════════════════════════════════════════════════
function ResumenView({ data, rango, onSelectCategory }: { data: any; rango: RangoFechas; onSelectCategory: (cat: string) => void }) {
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
                    onRowClick={(row) => onSelectCategory(row.nombre)}
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
function InsumosView({ data, rango, filtro, onFiltroChange, seleccionado, onSeleccionChange }: { data: any; rango: RangoFechas; filtro: string; onFiltroChange: (v: string) => void; seleccionado: string; onSeleccionChange: (v: string) => void }) {
    const filteredInsumos = useMemo(() => {
        if (!filtro) return data.rankingInsumos
        const lower = filtro.toLowerCase()
        return data.rankingInsumos.filter((i: any) =>
            i.nombre.toLowerCase().includes(lower) ||
            i.familia.toLowerCase().includes(lower)
        )
    }, [data.rankingInsumos, filtro])

    const totalInsumos = data.rankingInsumos.reduce((acc: number, i: any) => acc + i.costoTotal, 0)

    // FC/Remitos filtradas por el insumo seleccionado
    const comprasDelInsumo = useMemo(() => {
        if (!seleccionado) return []
        return (data.comprasDetalle || []).filter(
            (c: any) => c.insumo === seleccionado
        )
    }, [data.comprasDetalle, seleccionado])

    const insumoInfo = useMemo(() => {
        if (!seleccionado) return null
        return data.rankingInsumos.find((i: any) => i.nombre === seleccionado)
    }, [data.rankingInsumos, seleccionado])

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

    const detalleColumns = [
        { key: 'fecha', label: 'Fecha', sortable: true, width: '90px', format: (v: string) => formatDate(v) },
        { key: 'cantidad', label: 'Cantidad', align: 'right' as const, sortable: true, format: (v: number) => formatDecimal(v, 1) },
        { key: 'unidad', label: 'Ud.', width: '50px' },
        { key: 'precioUnitario', label: '$/Ud.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'costoTotal', label: 'Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'proveedor', label: 'Proveedor', sortable: true },
        { key: 'factura', label: 'FC/Remito', sortable: true, width: '110px' },
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
            <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                        fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', margin: 0
                    }}>
                        Desglose Completo por Insumo
                    </h3>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <select
                            className="form-input"
                            value={seleccionado}
                            onChange={e => onSeleccionChange(e.target.value)}
                            style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', minWidth: 180 }}
                        >
                            <option value="">Seleccionar insumo...</option>
                            {data.rankingInsumos.map((i: any) => (
                                <option key={i.nombre} value={i.nombre}>
                                    {i.nombre} ({formatCurrency(i.costoTotal)})
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Buscar insumo o familia..."
                            value={filtro}
                            onChange={e => onFiltroChange(e.target.value)}
                            style={{ maxWidth: 220, fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                        />
                    </div>
                </div>
                <DataTable
                    columns={insumoColumns}
                    data={filteredInsumos}
                    onRowClick={row => onSeleccionChange(row.nombre === seleccionado ? '' : row.nombre)}
                    selectedId={seleccionado}
                    showTotals={true}
                    totalColumns={['costoTotal']}
                    exportFilename={`Costos_Insumos_Detalle_${rango.label.replace(/\s+/g, "_")}`}
                    maxHeight="500px"
                    renderExpansion={() => (
                        <div style={{ padding: 'var(--space-2)' }}>
                            <DataTable 
                                columns={[
                                    { key: 'fecha', label: 'Fecha', format: (v) => formatDate(v) },
                                    { key: 'factura', label: 'Factura/Remito' },
                                    { key: 'costoTotal', label: 'Monto', align: 'right', format: (v) => formatCurrency(v) }
                                ]}
                                data={comprasDelInsumo}
                                showTotals={true}
                                totalColumns={['costoTotal']}
                                maxHeight="250px"
                            />
                        </div>
                    )}
                />
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════════════════
// SUB-TAB: PROVEEDORES
// ═══════════════════════════════════════════════════════════════
function ProveedoresView({ data, rango, seleccionado, onSeleccionChange }: { data: any; rango: RangoFechas; seleccionado: string; onSeleccionChange: (v: string) => void }) {
    const comprasDelProveedor = useMemo(() => {
        if (!seleccionado) return []
        return (data.comprasDetalle || []).filter(
            (c: any) => c.proveedor === seleccionado
        )
    }, [data.comprasDetalle, seleccionado])

    const proveedorInfo = useMemo(() => {
        if (!seleccionado) return null
        return data.gastoPorProveedor.find((p: any) => p.nombre === seleccionado)
    }, [data.gastoPorProveedor, seleccionado])

    const proveedorColumns = [
        { key: 'nombre', label: 'Proveedor', sortable: true },
        { key: 'compras', label: 'FC/Remitos', align: 'right' as const, sortable: true },
        { key: 'costoTotal', label: 'Total Facturado', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
    ]

    const detalleColumns = [
        { key: 'fecha', label: 'Fecha', sortable: true, width: '90px', format: (v: string) => formatDate(v) },
        { key: 'insumo', label: 'Insumo', sortable: true },
        { key: 'cantidad', label: 'Cantidad', align: 'right' as const, sortable: true, format: (v: number) => formatDecimal(v, 1) },
        { key: 'precioUnitario', label: '$/Ud.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'costoTotal', label: 'Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'factura', label: 'FC/Remito', sortable: true, width: '110px' },
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

            <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                        fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', margin: 0
                    }}>
                        Ranking de Proveedores
                    </h3>
                    <select
                        className="form-input"
                        value={seleccionado}
                        onChange={e => onSeleccionChange(e.target.value)}
                        style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', maxWidth: 220 }}
                    >
                        <option value="">Seleccionar proveedor...</option>
                        {data.gastoPorProveedor.map((p: any) => (
                            <option key={p.nombre} value={p.nombre}>
                                {p.nombre} ({formatCurrency(p.costoTotal)})
                            </option>
                        ))}
                    </select>
                </div>
                <DataTable
                    columns={proveedorColumns}
                    data={data.gastoPorProveedor}
                    onRowClick={row => onSeleccionChange(row.nombre === seleccionado ? '' : row.nombre)}
                    selectedId={seleccionado}
                    showTotals={true}
                    totalColumns={['costoTotal', 'compras']}
                    exportFilename={`Costos_Proveedores_${rango.label.replace(/\s+/g, "_")}`}
                    maxHeight="400px"
                    renderExpansion={() => (
                        <div style={{ padding: 'var(--space-2)' }}>
                            <DataTable 
                                columns={[
                                    { key: 'fecha', label: 'Fecha', format: (v) => formatDate(v) },
                                    { key: 'factura', label: 'Factura/Remito' },
                                    { key: 'costoTotal', label: 'Monto', align: 'right', format: (v) => formatCurrency(v) }
                                ]}
                                data={comprasDelProveedor}
                                showTotals={true}
                                totalColumns={['costoTotal']}
                                maxHeight="250px"
                            />
                        </div>
                    )}
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
// SUB-TAB: GASTOS OPERATIVOS (Desglose completo)
// ═══════════════════════════════════════════════════════════════
function GastosDetalleView({ data, rango, seleccionado, onSeleccionChange }: { data: any; rango: RangoFechas; seleccionado: string; onSeleccionChange: (v: string) => void }) {
    const [filtroGasto, setFiltroGasto] = useState('')

    const filteredGastos = useMemo(() => {
        let items = data.gastosDetalle || []
        if (seleccionado) {
            items = items.filter((g: any) => g.categoria === seleccionado)
        }
        if (filtroGasto) {
            const lower = filtroGasto.toLowerCase()
            items = items.filter((g: any) =>
                g.descripcion.toLowerCase().includes(lower) ||
                g.categoria.toLowerCase().includes(lower)
            )
        }
        return items
    }, [data.gastosDetalle, filtroGasto, seleccionado])

    const totalGastos = (data.gastosDetalle || []).reduce((acc: number, g: any) => acc + g.monto, 0)

    // Categorías únicas para filtro
    const categorias = useMemo(() => {
        const cats = new Set<string>()
        for (const g of (data.gastosDetalle || [])) cats.add(g.categoria)
        return Array.from(cats).sort()
    }, [data.gastosDetalle])

    const origenBadge = (origen: string) => {
        const styles: Record<string, { bg: string; label: string }> = {
            manual: { bg: '#3498DB22', label: 'Manual' },
            liquidacion: { bg: '#9B59B622', label: 'Liquidación' },
            mantenimiento: { bg: '#E67E2222', label: 'Flota' },
            caja: { bg: '#27AE6022', label: 'Caja' }
        }
        const s = styles[origen] || { bg: '#ccc', label: origen }
        return (
            <span style={{
                fontSize: 'var(--text-xs)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: s.bg,
                fontWeight: 600
            }}>
                {s.label}
            </span>
        )
    }

    const gastosColumns = [
        { key: 'fecha', label: 'Fecha', sortable: true, width: '90px', format: (v: string) => formatDate(v) },
        { key: 'categoria', label: 'Categoría', sortable: true, width: '110px' },
        { key: 'descripcion', label: 'Descripción', sortable: true },
        {
            key: 'origen', label: 'Origen', sortable: true, width: '90px',
            format: (v: string) => origenBadge(v)
        },
        { key: 'monto', label: 'Monto', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        {
            key: 'participacion', label: '% Part.', align: 'right' as const, sortable: false,
            format: (_v: number, row: any) => {
                const pct = totalGastos > 0 ? (row.monto / totalGastos) * 100 : 0
                return formatPercent(pct)
            }
        }
    ]

    return (
        <>
            {/* Gráfico por categoría */}
            {data.gastosPorCategoria.length > 0 && (
                <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                    <TrendChart
                        title="Distribución de Gastos Operativos"
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

            {/* Tabla detallada */}
            <div className="card" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                        fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', margin: 0
                    }}>
                        Desglose Completo de Gastos Operativos
                    </h3>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <select
                            className="form-input"
                            value={seleccionado}
                            onChange={e => onSeleccionChange(e.target.value)}
                            style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', minWidth: 140 }}
                        >
                            <option value="">Todas las categorías</option>
                            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Buscar descripción..."
                            value={filtroGasto}
                            onChange={e => setFiltroGasto(e.target.value)}
                            style={{ maxWidth: 240, fontSize: 'var(--text-xs)', padding: '4px 10px' }}
                        />
                    </div>
                </div>
                <DataTable
                    columns={gastosColumns}
                    data={filteredGastos}
                    showTotals={true}
                    totalColumns={['monto']}
                    exportFilename={`Gastos_Operativos_Detalle_${rango.label.replace(/\s+/g, "_")}`}
                    maxHeight="600px"
                />
            </div>
        </>
    )
}
// ═══════════════════════════════════════════════════════════════
function MargenesView({ data, rango }: { data: any; rango: RangoFechas }) {
    const k = data.kpis
    const esGanancia = k.gananciaActual >= 0
    const costoTotal = k.costoTotal

    // Líneas del P&L
    const plRows = [
        { label: 'Ventas', monto: k.ventasTotalActual, color: 'var(--color-success)', bold: true },
        { label: 'Compra de Insumos', monto: -k.costoInsumosActual, color: 'var(--color-danger)', bold: false },
        { label: 'Gastos Operativos', monto: -k.gastosTotalActual, color: 'var(--color-danger)', bold: false },
        { label: 'divider', monto: 0, color: '', bold: false },
        { label: esGanancia ? '✅ GANANCIA' : '🔻 PÉRDIDA', monto: k.gananciaActual, color: esGanancia ? 'var(--color-success)' : 'var(--color-danger)', bold: true },
    ]

    const productoColumns = [
        { key: 'nombre', label: 'Producto', sortable: true },
        { key: 'costoUnitario', label: 'Costo/u', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
        { key: 'cantidadPresentacion', label: 'Cant.', align: 'right' as const, sortable: true },
        { key: 'precioVenta', label: 'Precio Vta.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'costoTotal', label: 'Costo Pres.', align: 'right' as const, sortable: true, format: (v: number) => formatCurrencyDecimals(v) },
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
            {/* P&L Summary */}
            <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <h3 style={{
                    fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                    marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.03em'
                }}>
                    Estado de Resultados del Período
                </h3>
                <div style={{ maxWidth: 500 }}>
                    {plRows.map((row, i) => {
                        if (row.label === 'divider') {
                            return <hr key={i} style={{ border: 'none', borderTop: '2px solid var(--color-gray-200)', margin: '8px 0' }} />
                        }
                        return (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                fontWeight: row.bold ? 700 : 400,
                                fontSize: row.bold ? 'var(--text-base)' : 'var(--text-sm)',
                                borderBottom: !row.bold ? '1px solid var(--color-gray-50)' : undefined
                            }}>
                                <span>{row.label}</span>
                                <span style={{ color: row.color, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                                    {row.monto < 0 ? '-' : ''}{formatCurrency(Math.abs(row.monto))}
                                </span>
                            </div>
                        )
                    })}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-gray-500)'
                    }}>
                        <span>Margen neto</span>
                        <span style={{ fontWeight: 600 }}>{formatPercent(k.margenReal)}</span>
                    </div>
                </div>
            </div>

            {/* Visual comparison chart */}
            <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <TrendChart
                    title="Ventas vs Costos"
                    labels={['Ventas', 'Insumos', 'Gastos Op.', 'Resultado']}
                    datasets={[{
                        label: 'Monto',
                        data: [k.ventasTotalActual, k.costoInsumosActual, k.gastosTotalActual, Math.abs(k.gananciaActual)],
                        color: esGanancia ? '#2ECC71' : '#E74C3C'
                    }]}
                    formatTooltip={(v: number) => formatCurrency(v)}
                    showLegend={false}
                />
            </div>

            {/* Tabla margen teórico por producto */}
            <div className="card" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{
                    fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)',
                    marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.03em'
                }}>
                    Margen Teórico por Producto (según Ficha Técnica)
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
