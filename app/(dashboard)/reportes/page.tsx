'use client'

import { useState, useEffect } from 'react'
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import ProduccionReport from './ProduccionReport'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

interface RentabilidadData {
    mes: number
    anio: number
    ingresosTotales: number
    costoMercaderiaVendida: number
    margenBruto: number
    totalGastos: number
    rentabilidadNeta: number
    margenEbitda: number
    gastosPorCategoria: Record<string, number>
}

export default function ReportesPage() {
    const [activeTab, setActiveTab] = useState<'economico' | 'produccion'>('economico')
    const [rentabilidadData, setRentabilidadData] = useState<RentabilidadData | null>(null)
    const [produccionData, setProduccionData] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)

    const d = new Date()
    const [mes, setMes] = useState(String(d.getMonth() + 1))
    const [anio, setAnio] = useState(String(d.getFullYear()))

    useEffect(() => {
        fetchData()
    }, [mes, anio, activeTab])

    async function fetchData() {
        setLoading(true)
        try {
            if (activeTab === 'economico') {
                const res = await fetch(`/api/reportes/rentabilidad?mes=${mes}&anio=${anio}`)
                const json = await res.json()
                setRentabilidadData(json)
            } else {
                const res = await fetch(`/api/reportes/produccion?mes=${mes}&anio=${anio}`)
                const json = await res.json()
                setProduccionData(json)
            }
        } catch {
            console.error('Error fetching reporte')
        } finally {
            setLoading(false)
        }
    }

    // --- Economico Report Logic ---
    const barData = rentabilidadData ? {
        labels: [`Mes ${mes}/${anio}`],
        datasets: [
            {
                label: '1. Facturación (Ventas)',
                data: [rentabilidadData.ingresosTotales],
                backgroundColor: '#3498DB',
            },
            {
                label: '2. Costo Mercadería (CMV)',
                data: [rentabilidadData.costoMercaderiaVendida],
                backgroundColor: '#F39C12',
            },
            {
                label: '3. Gastos Operativos Totales',
                data: [rentabilidadData.totalGastos],
                backgroundColor: '#E74C3C',
            },
            {
                label: '➔ RESULTADO NETO (EBITDA)',
                data: [rentabilidadData.rentabilidadNeta],
                backgroundColor: rentabilidadData.rentabilidadNeta >= 0 ? '#2ECC71' : '#E74C3C',
            }
        ],
    } : null

    const catKeys = rentabilidadData ? Object.keys(rentabilidadData.gastosPorCategoria) : []
    const pieData = rentabilidadData ? {
        labels: catKeys.length > 0 ? catKeys : ['Sin Gastos'],
        datasets: [{
            data: catKeys.length > 0 ? Object.values(rentabilidadData.gastosPorCategoria) : [1],
            backgroundColor: catKeys.length > 0
                ? catKeys.map((_, i) => ['#E74C3C', '#9B59B6', '#34495E', '#F1C40F', '#1ABC9C', '#E67E22'][i % 6])
                : ['#ddd'],
            borderWidth: 0,
        }]
    } : null

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <h1 style={{ margin: 0 }}>📊 Reportes de Gestión</h1>
                        <div className="tabs" style={{ display: 'flex', backgroundColor: 'var(--color-gray-100)', padding: '4px', borderRadius: 'var(--radius-lg)', marginLeft: 'var(--space-4)' }}>
                            <button 
                                className={`btn btn-sm ${activeTab === 'economico' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('economico')}
                                style={{ borderRadius: 'var(--radius-md)' }}
                            >
                                💰 Económico
                            </button>
                            <button 
                                className={`btn btn-sm ${activeTab === 'produccion' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('produccion')}
                                style={{ borderRadius: 'var(--radius-md)' }}
                            >
                                🏭 Producción
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <select className="form-select" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 140 }}>
                            <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option>
                            <option value="4">Abril</option><option value="5">Mayo</option><option value="6">Junio</option>
                            <option value="7">Julio</option><option value="8">Agosto</option><option value="9">Septiembre</option>
                            <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                        </select>
                        <select className="form-select" value={anio} onChange={e => setAnio(e.target.value)} style={{ width: 90 }}>
                            <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                        </select>
                    </div>
                </div>
            </div>

            {activeTab === 'economico' && rentabilidadData && (
                <div className="fade-in">
                    {/* KPIs Económicos */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Ingresos Brutos</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                                ${rentabilidadData.ingresosTotales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Margen Contribución</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-secondary)' }}>
                                ${rentabilidadData.margenBruto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Rentabilidad Neta</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: rentabilidadData.rentabilidadNeta >= 0 ? '#2ECC71' : '#E74C3C' }}>
                                ${rentabilidadData.rentabilidadNeta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Margen EBITDA %</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: rentabilidadData.margenEbitda >= 15 ? 'var(--color-success)' : rentabilidadData.margenEbitda > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                {rentabilidadData.margenEbitda.toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
                        <div className="card" style={{ padding: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)' }}>Cascada de Resultados</h3>
                            <div style={{ height: '300px' }}>
                                {barData && (
                                    <Bar
                                        data={barData}
                                        options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="card" style={{ padding: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>Distribución de Gastos</h3>
                            <div style={{ height: '240px', position: 'relative' }}>
                                {pieData && (
                                    <Doughnut
                                        data={pieData}
                                        options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'produccion' && (
                <ProduccionReport data={produccionData} loading={loading} />
            )}

            {loading && (activeTab === 'economico' && !rentabilidadData) && (
                <div className="empty-state"><div className="spinner" /><p>Generando reporte...</p></div>
            )}
        </div>
    )
}
