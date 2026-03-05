'use client'

import { useState, useEffect } from 'react'
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

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
    const [data, setData] = useState<RentabilidadData | null>(null)
    const [loading, setLoading] = useState(true)

    const d = new Date()
    const [mes, setMes] = useState(String(d.getMonth() + 1))
    const [anio, setAnio] = useState(String(d.getFullYear()))

    useEffect(() => {
        fetchData()
    }, [mes, anio])

    async function fetchData() {
        setLoading(true)
        try {
            const res = await fetch(`/api/reportes/rentabilidad?mes=${mes}&anio=${anio}`)
            const json = await res.json()
            setData(json)
        } catch {
            console.error('Error fetching reporte')
        } finally {
            setLoading(false)
        }
    }

    if (loading || !data) return <div className="empty-state"><div className="spinner" /><p>Generando reporte...</p></div>

    // Data for Bar Chart: Margen Bruto, Gastos, Neto
    const barData = {
        labels: [`Mes ${mes}/${anio}`],
        datasets: [
            {
                label: '1. Facturación (Ventas)',
                data: [data.ingresosTotales],
                backgroundColor: '#3498DB',
            },
            {
                label: '2. Costo Mercadería (CMV)',
                data: [data.costoMercaderiaVendida],
                backgroundColor: '#F39C12',
            },
            {
                label: '3. Gastos Operativos Totales',
                data: [data.totalGastos],
                backgroundColor: '#E74C3C',
            },
            {
                label: '➔ RESULTADO NETO (EBITDA)',
                data: [data.rentabilidadNeta],
                backgroundColor: data.rentabilidadNeta >= 0 ? '#2ECC71' : '#E74C3C',
            }
        ],
    }

    // Cost Breakdown array
    const catKeys = Object.keys(data.gastosPorCategoria)
    const pieData = {
        labels: catKeys.length > 0 ? catKeys : ['Sin Gastos'],
        datasets: [{
            data: catKeys.length > 0 ? Object.values(data.gastosPorCategoria) : [1],
            backgroundColor: catKeys.length > 0
                ? catKeys.map((_, i) => ['#E74C3C', '#9B59B6', '#34495E', '#F1C40F', '#1ABC9C', '#E67E22'][i % 6])
                : ['#ddd'],
            borderWidth: 0,
        }]
    }

    return (
        <div>
            <div className="page-header">
                <h1>📈 Reporte Económico y Rentabilidad</h1>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <select className="form-select" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 150 }}>
                        <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option>
                        <option value="4">Abril</option><option value="5">Mayo</option><option value="6">Junio</option>
                        <option value="7">Julio</option><option value="8">Agosto</option><option value="9">Septiembre</option>
                        <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                    </select>
                    <select className="form-select" value={anio} onChange={e => setAnio(e.target.value)} style={{ width: 100 }}>
                        <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                    </select>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Ingresos Brutos</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                        ${data.ingresosTotales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Margen Contribución</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-secondary)' }}>
                        ${data.margenBruto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Rentabilidad Neta</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: data.rentabilidadNeta >= 0 ? '#2ECC71' : '#E74C3C' }}>
                        ${data.rentabilidadNeta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Margen EBITDA %</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: data.margenEbitda >= 15 ? 'var(--color-success)' : data.margenEbitda > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                        {data.margenEbitda.toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)' }}>Cascada de Resultados</h3>
                    <div style={{ height: '300px' }}>
                        <Bar
                            data={barData}
                            options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }}
                        />
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>Distribución de Gastos</h3>
                    <div style={{ height: '240px', position: 'relative' }}>
                        <Doughnut
                            data={pieData}
                            options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
