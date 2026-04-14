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

export default function VentasSection({ rango, ubicacionId }: Props) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const params = new URLSearchParams({ desde: rango.desde.toISOString(), hasta: rango.hasta.toISOString(), ...(ubicacionId && { ubicacionId }) })
                const res = await fetch(`/api/reportes/ventas?${params}`)
                if (res.ok) setData(await res.json())
            } catch (err) {
                console.error('Error fetching ventas:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [rango.desde.toISOString(), rango.hasta.toISOString(), ubicacionId])

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Calculando ventas...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos disponibles.</p></div>

    const k = data.kpis
    const deltaFacturacion = formatDelta(k.facturacionTotal, k.facturacionAnterior)
    const deltaPedidos = formatDelta(k.pedidoCount, k.pedidoCountAnterior)
    const deltaUnidades = formatDelta(k.unidadesTotales, k.unidadesAnterior)
    const deltaTicket = formatDelta(k.ticketPromedio, k.ticketPromedioAnterior)

    const productoColumns = [
        { key: 'ranking', label: '#', width: '40px', sortable: false },
        { key: 'nombre', label: 'Producto', sortable: true },
        { key: 'codigo', label: 'Código', sortable: true, width: '90px' },
        { key: 'cantidad', label: 'Unidades', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'importe', label: 'Facturado', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'participacion', label: '% Part.', align: 'right' as const, sortable: true, format: (v: number) => formatPercent(v) },
    ]

    const clienteColumns = [
        { key: 'ranking', label: '#', width: '40px', sortable: false },
        { key: 'nombre', label: 'Cliente', sortable: true },
        { key: 'zona', label: 'Zona', sortable: true, width: '100px' },
        { key: 'pedidos', label: 'Pedidos', align: 'right' as const, sortable: true, format: (v: number) => formatNumber(v) },
        { key: 'importe', label: 'Facturado', align: 'right' as const, sortable: true, format: (v: number) => formatCurrency(v) },
        { key: 'participacion', label: '% Part.', align: 'right' as const, sortable: true, format: (v: number) => formatPercent(v) },
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
                    label="Facturación Total"
                    value={formatCurrency(k.facturacionTotal)}
                    icon="💰"
                    color="var(--color-info)"
                    delta={deltaFacturacion}
                    previousLabel="período ant."
                />
                <KpiCardEnhanced
                    label="Pedidos Entregados"
                    value={formatNumber(k.pedidoCount)}
                    icon="📋"
                    color="var(--color-primary)"
                    delta={deltaPedidos}
                    previousLabel="período ant."
                />
                <KpiCardEnhanced
                    label="Unidades Vendidas"
                    value={formatNumber(k.unidadesTotales)}
                    icon="📦"
                    color="var(--color-success)"
                    delta={deltaUnidades}
                    previousLabel="período ant."
                />
                <KpiCardEnhanced
                    label="Ticket Promedio"
                    value={formatCurrency(k.ticketPromedio)}
                    icon="🎫"
                    color="var(--color-warning)"
                    delta={deltaTicket}
                    previousLabel="período ant."
                />
            </div>

            {/* Charts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-6)',
                marginBottom: 'var(--space-6)'
            }}>
                {/* Tendencia diaria */}
                {data.tendenciaDiaria.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Facturación Diaria"
                            type="line"
                            labels={data.tendenciaDiaria.map((d: any) => d.label)}
                            datasets={[{
                                label: 'Facturación',
                                data: data.tendenciaDiaria.map((d: any) => d.importe),
                                color: '#3498DB',
                                type: 'line',
                                fill: true
                            }]}
                            formatTooltip={(v: number) => formatCurrency(v)}
                        />
                    </div>
                )}

                {/* Medios de pago */}
                {data.mediosPago.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                        <TrendChart
                            title="Facturación por Medio de Pago"
                            labels={data.mediosPago.map((m: any) => m.medio)}
                            datasets={[{
                                label: 'Importe',
                                data: data.mediosPago.map((m: any) => m.importe)
                            }]}
                            formatTooltip={(v: number) => formatCurrency(v)}
                            showLegend={false}
                        />
                    </div>
                )}
            </div>

            {/* Tablas */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
                gap: 'var(--space-6)'
            }}>
                {/* Ranking productos */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-gray-600)',
                        marginBottom: 'var(--space-4)',
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.03em'
                    }}>
                        Ranking de Productos
                    </h3>
                    <DataTable
                        columns={productoColumns}
                        data={data.rankingProductos}
                        showTotals={true}
                        totalColumns={['cantidad', 'importe']}
                        exportFilename={`Ventas_Productos_${rango.label.replace(/\s+/g, "_")}`}
                        maxHeight="350px"
                    />
                </div>

                {/* Ranking clientes */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-gray-600)',
                        marginBottom: 'var(--space-4)',
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.03em'
                    }}>
                        Ranking de Clientes
                    </h3>
                    <DataTable
                        columns={clienteColumns}
                        data={data.rankingClientes}
                        showTotals={true}
                        totalColumns={['pedidos', 'importe']}
                        exportFilename={`Ventas_Clientes_${rango.label.replace(/\s+/g, "_")}`}
                        maxHeight="350px"
                    />
                </div>
            </div>
        </div>
    )
}
