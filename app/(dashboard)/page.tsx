'use client'

import { useState, useEffect } from 'react'
import styles from './page.module.css'

interface DashboardData {
    pedidosHoy: number
    pedidosPendientes: number
    ingresosMes: number
    pedidosEntregadosMes: number
    lotesHoy: number
    unidadesHoy: number
    produccionPorUbicacion: { ubicacion: string; unidades: number; lotes: number }[]
    insumosAlerta: number
    entregasHoy: number
    gastosMes: number
    comprasPendientes: number
    ultimosMovimientos: {
        id: string; tipo: string; cantidad: number; fecha: string
        insumo: { nombre: string; unidadMedida: string }
        proveedor: { nombre: string } | null
    }[]
    ultimosPedidos: {
        id: string; estado: string; totalImporte: number; fechaPedido: string; totalUnidades: number
        cliente: { nombreComercial: string }
    }[]
}

const estadoColors: Record<string, { bg: string; color: string; border: string }> = {
    pendiente: { bg: '#F39C1215', color: '#E67E22', border: '#F39C1240' },
    confirmado: { bg: '#3498DB15', color: '#2980B9', border: '#3498DB40' },
    en_ruta: { bg: '#9B59B615', color: '#8E44AD', border: '#9B59B640' },
    entregado: { bg: '#2ECC7115', color: '#27AE60', border: '#2ECC7140' },
    rechazado: { bg: '#E74C3C15', color: '#C0392B', border: '#E74C3C40' },
}

function formatCurrency(n: number) {
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = () => {
            fetch('/api/dashboard')
                .then((r) => r.json())
                .then((d) => setData(d))
                .catch(() => { })
                .finally(() => setLoading(false))
        }

        fetchData()
        const interval = setInterval(fetchData, 5000)
        return () => clearInterval(interval)
    }, [])

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando dashboard...</p></div>

    if (!data) return <div className="empty-state"><p>Error al cargar el dashboard</p></div>

    const margenNeto = data.ingresosMes - data.gastosMes

    return (
        <div>
            <div className="page-header">
                <h1>📊 Dashboard</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>
                        {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <div style={{ padding: '4px 12px', background: '#F8F9FA', borderRadius: '20px', fontSize: '12px', color: '#6C757D', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #DEE2E6' }}>
                        <div style={{ width: '8px', height: '8px', background: '#27AE60', borderRadius: '50%', boxShadow: '0 0 8px #2ECC71' }} />
                        <span style={{ fontWeight: 600, letterSpacing: '0.5px' }}>LIVE</span>
                    </div>
                </div>
            </div>

            {/* ═══ Fila 1: KPIs Principales ═══ */}
            <div className={styles.statsGrid}>
                <div className={`card ${styles.statCard}`}>
                    <div className="card-body">
                        <div className={styles.statIcon}>📋</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Pedidos Hoy</span>
                            <span className={styles.statValue}>{data.pedidosHoy}</span>
                            <span className={styles.statDetail}>{data.entregasHoy} entregas realizadas</span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCard}`}>
                    <div className="card-body">
                        <div className={styles.statIcon}>💰</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Ingresos del Mes</span>
                            <span className={styles.statValue} style={{ color: '#27AE60' }}>{formatCurrency(data.ingresosMes)}</span>
                            <span className={styles.statDetail}>{data.pedidosEntregadosMes} pedidos entregados</span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCard}`}>
                    <div className="card-body">
                        <div className={styles.statIcon}>🏭</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Producción Hoy</span>
                            <span className={styles.statValue}>{data.unidadesHoy.toLocaleString('es-AR')}</span>
                            <div className={styles.statDetail}>
                                {data.produccionPorUbicacion.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                        {data.produccionPorUbicacion.map((p, i) => (
                                            <span key={i} style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                                • {p.unidades} en <b>{p.ubicacion}</b>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span>{data.lotesHoy} lotes registrados</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCard}`} style={data.insumosAlerta > 0 ? { borderLeft: '4px solid #E74C3C' } : {}}>
                    <div className="card-body">
                        <div className={styles.statIcon}>{data.insumosAlerta > 0 ? '🚨' : '📦'}</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Insumos Bajo Mínimo</span>
                            <span className={styles.statValue} style={{ color: data.insumosAlerta > 0 ? '#E74C3C' : '#27AE60' }}>
                                {data.insumosAlerta}
                            </span>
                            <span className={styles.statDetail}>
                                {data.insumosAlerta > 0 ? '¡Reabastecer urgente!' : 'Todo en orden'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Fila 2: KPIs Secundarios ═══ */}
            <div className={styles.statsGridSecondary}>
                <div className={`card ${styles.statCardSmall}`}>
                    <div className="card-body">
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>🕐 Pedidos Pendientes</span>
                            <span className={styles.statValue} style={{ fontSize: '1.8rem', color: data.pedidosPendientes > 0 ? '#E67E22' : '#27AE60' }}>
                                {data.pedidosPendientes}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCardSmall}`}>
                    <div className="card-body">
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>📊 Gastos del Mes</span>
                            <span className={styles.statValue} style={{ fontSize: '1.8rem', color: '#E74C3C' }}>
                                {formatCurrency(data.gastosMes)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCardSmall}`}>
                    <div className="card-body">
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>💳 Compras por Pagar</span>
                            <span className={styles.statValue} style={{ fontSize: '1.8rem', color: data.comprasPendientes > 0 ? '#E67E22' : '#27AE60' }}>
                                {data.comprasPendientes}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCardSmall}`}>
                    <div className="card-body">
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>📈 Resultado Neto (Mes)</span>
                            <span className={styles.statValue} style={{ fontSize: '1.8rem', color: margenNeto >= 0 ? '#27AE60' : '#E74C3C' }}>
                                {formatCurrency(margenNeto)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Fila 3: Tablas Resumen ═══ */}
            <div className={styles.tablesRow}>
                {/* Últimos Movimientos */}
                <div className="card">
                    <div className="card-body">
                        <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1rem', fontWeight: 700 }}>📦 Últimos Movimientos de Stock</h3>
                        {data.ultimosMovimientos.length === 0 ? (
                            <p style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: '1rem' }}>Sin movimientos recientes</p>
                        ) : (
                            <table className="table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Insumo</th>
                                        <th>Cant.</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.ultimosMovimientos.map((mov) => (
                                        <tr key={mov.id}>
                                            <td>
                                                <span className="badge" style={{
                                                    backgroundColor: mov.tipo === 'entrada' ? '#2ECC7120' : '#E74C3C20',
                                                    color: mov.tipo === 'entrada' ? '#2ECC71' : '#E74C3C',
                                                    border: `1px solid ${mov.tipo === 'entrada' ? '#2ECC7140' : '#E74C3C40'}`,
                                                    fontSize: '0.7rem',
                                                }}>
                                                    {mov.tipo === 'entrada' ? '⬆️' : '⬇️'} {mov.tipo}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{mov.insumo.nombre}</td>
                                            <td>{mov.cantidad} {mov.insumo.unidadMedida}</td>
                                            <td style={{ color: 'var(--color-gray-400)', fontSize: '0.8rem' }}>
                                                {new Date(mov.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Últimos Pedidos */}
                <div className="card">
                    <div className="card-body">
                        <h3 style={{ marginBottom: 'var(--space-4)', fontSize: '1rem', fontWeight: 700 }}>📋 Últimos Pedidos</h3>
                        {data.ultimosPedidos.length === 0 ? (
                            <p style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: '1rem' }}>Sin pedidos recientes</p>
                        ) : (
                            <table className="table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Estado</th>
                                        <th>Importe</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.ultimosPedidos.map((ped) => {
                                        const st = estadoColors[ped.estado] || estadoColors.pendiente
                                        return (
                                            <tr key={ped.id}>
                                                <td style={{ fontWeight: 600 }}>{ped.cliente.nombreComercial}</td>
                                                <td>
                                                    <span className="badge" style={{
                                                        backgroundColor: st.bg, color: st.color,
                                                        border: `1px solid ${st.border}`, fontSize: '0.7rem',
                                                    }}>
                                                        {ped.estado.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td>{formatCurrency(ped.totalImporte)}</td>
                                                <td style={{ color: 'var(--color-gray-400)', fontSize: '0.8rem' }}>
                                                    {new Date(ped.fechaPedido).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
