'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { RangoFechas } from '../utils/dateUtils'
import KpiCardEnhanced from '../components/KpiCardEnhanced'
import TrendChart from '../components/TrendChart'
import DataTable from '../components/DataTable'
import { formatCurrency, formatPercent, formatNumber, formatDate } from '../utils/formatters'

interface Props {
    rango: RangoFechas
    ubicacionId: string
}

type SubTab = 'resumen' | 'ingresos' | 'egresos' | 'movimientos'

export default function CajaSection({ rango, ubicacionId }: Props) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [subTab, setSubTab] = useState<SubTab>('resumen')
    
    // Filtros de movimientos
    const [filtroTipo, setFiltroTipo] = useState<string>('todos')
    const [filtroMedio, setFiltroMedio] = useState<string>('todos')
    const [busqueda, setBusqueda] = useState<string>('')

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const params = new URLSearchParams({ 
                    desde: rango.desde.toISOString(), 
                    hasta: rango.hasta.toISOString(), 
                    ...(ubicacionId && { ubicacionId })
                })
                const res = await fetch(`/api/reportes/caja?${params}`)
                if (res.ok) setData(await res.json())
            } catch (err) {
                console.error('Error fetching caja report:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [rango.desde.toISOString(), rango.hasta.toISOString(), ubicacionId])

    const subTabs: { key: SubTab; label: string; icon: string }[] = [
        { key: 'resumen', label: 'Resumen Financiero', icon: '📊' },
        { key: 'ingresos', label: 'Ingresos (Cobros)', icon: '📥' },
        { key: 'egresos', label: 'Egresos (Gastos)', icon: '📤' },
        { key: 'movimientos', label: 'Auditoría de Caja', icon: '🔍' },
    ]

    const filteredMovimientos = useMemo(() => {
        if (!data || !data.movimientosDetalle) return []
        return data.movimientosDetalle.filter((m: any) => {
            const matchesTipo = filtroTipo === 'todos' || m.tipo === filtroTipo
            const matchesMedio = filtroMedio === 'todos' || m.medioPago === filtroMedio
            const matchesSearch = busqueda === '' || 
                m.concepto.toLowerCase().includes(busqueda.toLowerCase()) ||
                m.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
                m.cajaOrigen.toLowerCase().includes(busqueda.toLowerCase())
            return matchesTipo && matchesMedio && matchesSearch
        })
    }, [data, filtroTipo, filtroMedio, busqueda])

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Calculando flujo de caja...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos de caja disponibles para este periodo.</p></div>

    const k = data.kpis
    const esNetoPositivo = k.flujoNetoTotal >= 0

    // Columnas para tablas de conceptos
    const conceptoColumns = (totalMonto: number, filenamePrefix: string) => [
        { key: 'nombre', label: 'Concepto', sortable: true },
        { key: 'efectivo', label: 'Efectivo 💵', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'transferencia', label: 'Transferencia 🏦', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'total', label: 'Monto Total', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        {
            key: 'participacion', label: '% Part.', align: 'right' as const, sortable: true,
            format: (_v: number, row: any) => {
                const pct = totalMonto > 0 ? (row.total / totalMonto) * 100 : 0
                return formatPercent(pct)
            }
        }
    ]

    // Columnas para tabla de movimientos (Auditoría)
    const movimientosColumns = [
        { key: 'fecha', label: 'Fecha', sortable: true, width: '90px', format: (v: string) => formatDate(v) },
        { 
            key: 'tipo', label: 'Tipo', sortable: true, width: '90px',
            format: (v: string) => (
                <span className="badge" style={{ 
                    backgroundColor: v === 'ingreso' ? '#27AE6020' : '#E74C3C20', 
                    color: v === 'ingreso' ? '#27AE60' : '#E74C3C',
                    border: `1px solid ${v === 'ingreso' ? '#27AE6040' : '#E74C3C40'}`,
                    fontWeight: 600
                }}>
                    {v === 'ingreso' ? '📥 Ingreso' : '📤 Egreso'}
                </span>
            )
        },
        { key: 'concepto', label: 'Concepto', sortable: true, width: '150px' },
        { key: 'descripcion', label: 'Descripción', sortable: true },
        { key: 'cajaOrigen', label: 'Caja', sortable: true, width: '120px' },
        { 
            key: 'medioPago', label: 'Medio de Pago', sortable: true, width: '130px',
            format: (v: string) => (
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)' }}>
                    {v === 'transferencia' ? '🏦 Transf.' : '💵 Efectivo'}
                </span>
            )
        },
        { 
            key: 'monto', label: 'Monto', align: 'right' as const, sortable: true, 
            format: (v: number, row: any) => (
                <span style={{ 
                    fontWeight: 700, 
                    color: row.tipo === 'ingreso' ? 'var(--color-success)' : 'var(--color-danger)',
                    fontFamily: 'var(--font-mono, monospace)'
                }}>
                    {row.tipo === 'egreso' ? '-' : ''}${v.toLocaleString('es-AR')}
                </span>
            )
        },
    ]

    return (
        <div className="fade-in">
            {/* KPIs */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                <KpiCardEnhanced
                    label="Ingresos Totales (Cobros)"
                    value={formatCurrency(k.ingresosTotal)}
                    icon="📥"
                    color="var(--color-success)"
                    previousLabel="Efectivo vs. Transf."
                    footer={`💵 ${formatCurrency(k.ingresosEfectivo)}  |  🏦 ${formatCurrency(k.ingresosTransferencia)}`}
                    onClick={() => setSubTab('ingresos')}
                />
                <KpiCardEnhanced
                    label="Egresos Totales (Gastos)"
                    value={formatCurrency(k.egresosTotal)}
                    icon="📤"
                    color="var(--color-danger)"
                    previousLabel="Efectivo vs. Transf."
                    footer={`💵 ${formatCurrency(k.egresosEfectivo)}  |  🏦 ${formatCurrency(k.egresosTransferencia)}`}
                    onClick={() => setSubTab('egresos')}
                />
                <KpiCardEnhanced
                    label="Flujo Neto Neto"
                    value={formatCurrency(k.flujoNetoTotal)}
                    icon={esNetoPositivo ? '✅' : '🔻'}
                    color={esNetoPositivo ? 'var(--color-success)' : 'var(--color-danger)'}
                    previousLabel="Resultado del Periodo"
                    footer={`💵 ${k.flujoNetoEfectivo >= 0 ? '+' : ''}${formatCurrency(k.flujoNetoEfectivo)}  |  🏦 ${k.flujoNetoTransferencia >= 0 ? '+' : ''}${formatCurrency(k.flujoNetoTransferencia)}`}
                    onClick={() => setSubTab('resumen')}
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

            {/* Vistas según pestaña */}
            {subTab === 'resumen' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* Gráficos principales */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                        gap: 'var(--space-6)'
                    }}>
                        {/* Tendencia Temporal */}
                        {data.tendenciaDiaria.length > 0 && (
                            <div className="card" style={{ padding: 'var(--space-6)' }}>
                                <TrendChart
                                    title="Ingresos vs. Egresos Diarios"
                                    type="line"
                                    labels={data.tendenciaDiaria.map((d: any) => d.label)}
                                    datasets={[
                                        { label: 'Ingresos', data: data.tendenciaDiaria.map((d: any) => d.ingresosEf + d.ingresosTr), color: '#2ECC71', type: 'line', fill: true },
                                        { label: 'Egresos', data: data.tendenciaDiaria.map((d: any) => d.egresosEf + d.egresosTr), color: '#E74C3C', type: 'line', fill: false }
                                    ]}
                                    formatTooltip={(v: number) => formatCurrency(v)}
                                />
                            </div>
                        )}

                        {/* Distribución por Medio de Pago en Gastos */}
                        <div className="card" style={{ padding: 'var(--space-6)' }}>
                            <TrendChart
                                title="Egresos (Gastos) por Medio de Pago"
                                labels={['Efectivo 💵', 'Transferencia 🏦']}
                                datasets={[{
                                    label: 'Monto',
                                    data: [k.egresosEfectivo, k.egresosTransferencia]
                                }]}
                                formatTooltip={(v: number) => formatCurrency(v)}
                                showLegend={false}
                            />
                        </div>
                    </div>

                    {/* Resumen de Desgloses Rápidos */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                        gap: 'var(--space-6)'
                    }}>
                        <div className="card" style={{ padding: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)' }}>
                                Principales Conceptos de Gasto
                            </h3>
                            <DataTable
                                columns={conceptoColumns(k.egresosTotal, 'egresos').slice(0, 4)} // solo columnas principales
                                data={data.egresosDesglose.slice(0, 5)}
                                showTotals={false}
                                maxHeight="250px"
                            />
                        </div>

                        <div className="card" style={{ padding: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)' }}>
                                Principales Conceptos de Ingreso
                            </h3>
                            <DataTable
                                columns={conceptoColumns(k.ingresosTotal, 'ingresos').slice(0, 4)}
                                data={data.ingresosDesglose.slice(0, 5)}
                                showTotals={false}
                                maxHeight="250px"
                            />
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'ingresos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {data.ingresosDesglose.length > 0 && (
                        <div className="card" style={{ padding: 'var(--space-6)' }}>
                            <TrendChart
                                title="Distribución de Ingresos por Concepto"
                                labels={data.ingresosDesglose.map((c: any) => c.nombre)}
                                datasets={[{
                                    label: 'Total',
                                    data: data.ingresosDesglose.map((c: any) => c.total),
                                    color: '#2ECC71'
                                }]}
                                formatTooltip={(v: number) => formatCurrency(v)}
                                showLegend={false}
                            />
                        </div>
                    )}

                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)' }}>
                            Desglose de Ingresos
                        </h3>
                        <DataTable
                            columns={conceptoColumns(k.ingresosTotal, 'ingresos')}
                            data={data.ingresosDesglose}
                            showTotals={true}
                            totalColumns={['efectivo', 'transferencia', 'total']}
                            exportFilename={`Ingresos_Conceptos_${rango.label.replace(/\s+/g, "_")}`}
                            maxHeight="450px"
                        />
                    </div>
                </div>
            )}

            {subTab === 'egresos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {data.egresosDesglose.length > 0 && (
                        <div className="card" style={{ padding: 'var(--space-6)' }}>
                            <TrendChart
                                title="Distribución de Egresos por Concepto"
                                labels={data.egresosDesglose.map((c: any) => c.nombre)}
                                datasets={[{
                                    label: 'Total',
                                    data: data.egresosDesglose.map((c: any) => c.total),
                                    color: '#E74C3C'
                                }]}
                                formatTooltip={(v: number) => formatCurrency(v)}
                                showLegend={false}
                            />
                        </div>
                    )}

                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)' }}>
                            Desglose de Egresos
                        </h3>
                        <DataTable
                            columns={conceptoColumns(k.egresosTotal, 'egresos')}
                            data={data.egresosDesglose}
                            showTotals={true}
                            totalColumns={['efectivo', 'transferencia', 'total']}
                            exportFilename={`Egresos_Conceptos_${rango.label.replace(/\s+/g, "_")}`}
                            maxHeight="450px"
                        />
                    </div>
                </div>
            )}

            {subTab === 'movimientos' && (
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    {/* Cabecera de filtros */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 'var(--space-4)', 
                        flexWrap: 'wrap', 
                        gap: 'var(--space-3)' 
                    }}>
                        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', fontFamily: 'var(--font-heading)', margin: 0 }}>
                            Historial Detallado de Movimientos
                        </h3>
                        
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Selector de Tipo */}
                            <select 
                                className="form-select"
                                value={filtroTipo} 
                                onChange={e => setFiltroTipo(e.target.value)}
                                style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', width: 130 }}
                            >
                                <option value="todos">Todos los Tipos</option>
                                <option value="ingreso">Solo Ingresos</option>
                                <option value="egreso">Solo Egresos</option>
                            </select>

                            {/* Selector de Medio */}
                            <select 
                                className="form-select"
                                value={filtroMedio} 
                                onChange={e => setFiltroMedio(e.target.value)}
                                style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', width: 155 }}
                            >
                                <option value="todos">Todos los Medios</option>
                                <option value="efectivo">Solo Efectivo</option>
                                <option value="transferencia">Solo Transferencia</option>
                            </select>

                            {/* Buscador */}
                            <input
                                type="text"
                                className="form-input"
                                placeholder="🔍 Buscar concepto, desc, caja..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', maxWidth: 220 }}
                            />
                        </div>
                    </div>

                    <DataTable
                        columns={movimientosColumns}
                        data={filteredMovimientos}
                        showTotals={true}
                        totalColumns={['monto']}
                        exportFilename={`Movimientos_Caja_Detalle_${rango.label.replace(/\s+/g, "_")}`}
                        maxHeight="600px"
                    />
                </div>
            )}
        </div>
    )
}
