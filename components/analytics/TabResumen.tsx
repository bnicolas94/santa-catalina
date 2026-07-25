'use client'

import { Pie } from 'react-chartjs-2'
import type { AnalyticsData } from './analytics.types'

interface TabResumenProps {
    data: AnalyticsData
}

export default function TabResumen({ data }: TabResumenProps) {
    const areaChartData = {
        labels: data.distribucion.area.map(a => a.nombre),
        datasets: [{
            label: 'Empleados por Área',
            data: data.distribucion.area.map(a => a.cantidad),
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
            borderWidth: 1
        }]
    }

    const puestoChartData = {
        labels: data.distribucion.puesto.map(p => p.nombre),
        datasets: [{
            label: 'Empleados por Puesto',
            data: data.distribucion.puesto.map(p => p.cantidad),
            backgroundColor: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'],
            borderWidth: 1
        }]
    }

    return (
        <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Empleados Activos</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)' }}>{data.stats.activos}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Total Legajos: {data.stats.total}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Inversión del Período</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: 'var(--color-success)' }}>${data.nomina.total.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Masa salarial neta</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Horas Extras Pagadas</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: '#8b5cf6' }}>{data.nomina.totalHsExtras.toLocaleString()} hs</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Inversión: ${data.nomina.totalMontoHsExtras.toLocaleString()}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Tardanzas</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.asistencia.porcentajeTardanzas > 15 ? 'var(--color-danger)' : 'inherit' }}>{data.asistencia.porcentajeTardanzas.toFixed(1)}%</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{data.asistencia.tardanzas} fichadas con retraso</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Ausentismo</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.asistencia.porcentajeAusentismo > 10 ? 'var(--color-danger)' : 'inherit' }}>{data.asistencia.porcentajeAusentismo.toFixed(1)}%</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{data.asistencia.ausencias} ausencias</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #ec4899' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Antigüedad Promedio</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)' }}>{data.estructura.antiguedadPromedio} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>meses</span></div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Min: {data.estructura.antiguedadMinima} / Max: {data.estructura.antiguedadMaxima}</div>
                </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Distribución por Área</h3>
                    <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                        <Pie data={areaChartData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Distribución por Puesto</h3>
                    <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                        <Pie data={puestoChartData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>
        </div>
    )
}
