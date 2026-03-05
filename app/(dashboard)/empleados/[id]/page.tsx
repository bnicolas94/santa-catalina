'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { FichadasTab } from '@/components/empleados/FichadasTab'
import { PrestamosTab } from '@/components/empleados/PrestamosTab'
import { LiquidacionesTab } from '@/components/empleados/LiquidacionesTab'

export default function EmpleadoDetailPage() {
    const params = useParams()
    const [empleado, setEmpleado] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('resumen')

    useEffect(() => {
        if (params.id) {
            fetchEmpleado()
        }
    }, [params.id])

    const fetchEmpleado = async () => {
        try {
            // Reutilizando el endpoint actual buscando el empleado por id en el array entero
            // Lo ideal sería un GET /api/empleados/:id pero para no crear otro route lo filtramos acá para avanzar
            const res = await fetch('/api/empleados')
            const data = await res.json()
            const found = data.find((e: any) => e.id === params.id)
            setEmpleado(found || null)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
    }

    if (!empleado) {
        return <div className="p-10 text-center text-red-500">Empleado no encontrado</div>
    }

    return (
        <div>
            {/* Header del Perfil */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 'var(--text-3xl)', fontWeight: 'bold'
                        }}>
                            {empleado.nombre.charAt(0)}{empleado.apellido?.charAt(0) || ''}
                        </div>
                        <div>
                            <h1 style={{ margin: 0 }}>{empleado.nombre} {empleado.apellido}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-1)', color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>
                                <span className="badge badge-info">
                                    {empleado.rol}
                                </span>
                                <span>•</span>
                                <span>{empleado.email}</span>
                                <span>•</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>ID: {empleado.id.slice(0, 8)}...</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
                        <Link href="/empleados" className="btn btn-ghost btn-sm" style={{ fontWeight: 600 }}>
                            ← Volver a Lista
                        </Link>
                        <span className={`badge ${empleado.activo ? 'badge-success' : 'badge-neutral'}`}>
                            {empleado.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navegación de Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: 'var(--space-6)' }}>
                <button
                    onClick={() => setActiveTab('resumen')}
                    style={{
                        padding: 'var(--space-3) var(--space-6)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        borderBottom: activeTab === 'resumen' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        color: activeTab === 'resumen' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer'
                    }}
                >
                    Resumen
                </button>
                <button
                    onClick={() => setActiveTab('fichadas')}
                    style={{
                        padding: 'var(--space-3) var(--space-6)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        borderBottom: activeTab === 'fichadas' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        color: activeTab === 'fichadas' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer'
                    }}
                >
                    Fichadas
                </button>
                <button
                    onClick={() => setActiveTab('prestamos')}
                    style={{
                        padding: 'var(--space-3) var(--space-6)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        borderBottom: activeTab === 'prestamos' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        color: activeTab === 'prestamos' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer'
                    }}
                >
                    Préstamos
                </button>
                <button
                    onClick={() => setActiveTab('liquidaciones')}
                    style={{
                        padding: 'var(--space-3) var(--space-6)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        borderBottom: activeTab === 'liquidaciones' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        color: activeTab === 'liquidaciones' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer'
                    }}
                >
                    Recibos de Sueldo
                </button>
            </div>

            {/* Contenido de Tabs */}
            <div className="card" style={{ minHeight: '400px' }}>
                <div className="card-body">
                    {activeTab === 'resumen' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                            <div style={{ backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                                <h3 style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Configuración Salarial</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-gray-600)' }}>Sueldo Base ({empleado.cicloPago}):</span>
                                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>${empleado.sueldoBaseMensual.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-gray-600)' }}>Valor Hora (+):</span>
                                        <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{empleado.porcentajeHoraExtra}%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-gray-600)' }}>Feriados (+):</span>
                                        <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{empleado.porcentajeFeriado}%</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ backgroundColor: 'var(--color-info-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-info)' }}>
                                <h3 style={{ fontSize: 'var(--text-xs)', color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Jornada Laboral</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#1E40AF' }}>Días asignados:</span>
                                        <span style={{ fontWeight: 600, color: '#1E3A8A' }}>{empleado.diasTrabajoSemana}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#1E40AF' }}>Horas diarias:</span>
                                        <span style={{ fontWeight: 600, color: '#1E3A8A' }}>{empleado.horasTrabajoDiarias} hs</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(59, 130, 246, 0.2)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                        <span style={{ color: '#1E40AF' }}>Reloj Biométrico ID:</span>
                                        <span className="badge badge-info">{empleado.codigoBiometrico || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fichadas' && (
                        <FichadasTab empleadoId={empleado.id} />
                    )}

                    {activeTab === 'prestamos' && (
                        <PrestamosTab empleadoId={empleado.id} />
                    )}

                    {activeTab === 'liquidaciones' && (
                        <LiquidacionesTab empleadoId={empleado.id} empleadoDatos={empleado} />
                    )}
                </div>
            </div>
        </div>
    )
}
