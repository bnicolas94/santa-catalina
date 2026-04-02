'use client'

import { Bar } from 'react-chartjs-2'
import KpiCard from './components/KpiCard'

interface ProduccionData {
    mes: number
    anio: number
    globales: {
        totalPaquetes: number
        totalPlanchas: number
        totalSanguchitos: number
        totalRechazados: number
        totalLotes: number
    }
    desglose: {
        nombre: string
        codigo: string
        paquetes: number
        planchas: number
        sanguchitos: number
        rechazados: number
    }[]
    tendencia: {
        semana: string
        paquetes: number
    }[]
}

interface Props {
    data: ProduccionData | null
    loading: boolean
}

export default function ProduccionReport({ data, loading }: Props) {
    if (loading && !data) return <div className="empty-state"><div className="spinner" /><p>Calculando producción...</p></div>
    if (!data) return <div className="empty-state"><p>No hay datos disponibles para el periodo seleccionado.</p></div>

    const chartData = {
        labels: data.tendencia.map(t => t.semana),
        datasets: [
            {
                label: 'Paquetes Producidos',
                data: data.tendencia.map(t => t.paquetes),
                backgroundColor: '#3498DB',
                borderRadius: 4,
            }
        ]
    }

    return (
        <div className="fade-in">
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <KpiCard 
                    label="Total Paquetes" 
                    value={data.globales.totalPaquetes.toLocaleString('es-AR')} 
                    color="var(--color-primary)" 
                />
                <KpiCard 
                    label="Total Planchas" 
                    value={data.globales.totalPlanchas.toLocaleString('es-AR')} 
                    color="var(--color-secondary)" 
                />
                <KpiCard 
                    label="Total Sanguchitos" 
                    value={data.globales.totalSanguchitos.toLocaleString('es-AR')} 
                    color="var(--color-success)" 
                />
                <KpiCard 
                    label="Merma/Rechazos" 
                    value={data.globales.totalRechazados.toLocaleString('es-AR')} 
                    color="var(--color-danger)" 
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                {/* Tendencia Chart */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)' }}>Tendencia de Producción</h3>
                    <div style={{ height: '300px' }}>
                        <Bar
                            data={chartData}
                            options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                        />
                    </div>
                </div>

                {/* Desglose Table */}
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)' }}>Desglose por Producto</h3>
                    <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th style={{ textAlign: 'right' }}>Paq.</th>
                                    <th style={{ textAlign: 'right' }}>Pl.</th>
                                    <th style={{ textAlign: 'right' }}>Sang.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.desglose.map((prod, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{prod.nombre}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{prod.codigo}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{prod.paquetes.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right' }}>{prod.planchas.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right' }}>{prod.sanguchitos.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
