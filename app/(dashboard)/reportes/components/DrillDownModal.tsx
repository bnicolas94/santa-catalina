'use client'

import React, { useEffect, useState } from 'react'

interface DrillDownModalProps {
    tipo: 'pedidos' | 'gastos' | 'lotes'
    label: string
    desdeIso: string
    hastaIso: string
    ubicacionId?: string
    categoriaId?: string
    onClose: () => void
}

export default function DrillDownModal({ tipo, label, desdeIso, hastaIso, ubicacionId, categoriaId, onClose }: DrillDownModalProps) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDetalle()
    }, [tipo, desdeIso, hastaIso, ubicacionId, categoriaId])

    async function fetchDetalle() {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                tipo,
                desde: desdeIso,
                hasta: hastaIso,
                ...(ubicacionId && { ubicacionId }),
                ...(categoriaId && { categoriaId })
            })
            const res = await fetch(`/api/reportes/detalle?${params.toString()}`)
            const json = await res.json()
            setData(json)
        } catch (err) {
            console.error('Error fetching drill-down data:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-backdrop fade-in" style={{ 
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card shadow-xl slide-up" style={{ 
                width: '90%', maxWidth: '1000px', maxHeight: '85vh', 
                backgroundColor: 'white', display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{ 
                    padding: 'var(--space-6)', 
                    borderBottom: '1px solid var(--color-gray-100)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                        Desglose: {label}
                    </h2>
                    <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '24px' }}>&times;</button>
                </div>

                <div style={{ padding: 'var(--space-6)', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner" /><p>Cargando detalles...</p></div>
                    ) : data.length === 0 ? (
                        <div className="empty-state"><p>No se encontraron registros.</p></div>
                    ) : (
                        <table className="table">
                            <thead>
                                {tipo === 'pedidos' && (
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Cliente</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'right' }}>Importe</th>
                                    </tr>
                                )}
                                {tipo === 'gastos' && (
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Descripción</th>
                                        <th>Categoría</th>
                                        <th style={{ textAlign: 'right' }}>Monto</th>
                                    </tr>
                                )}
                                {tipo === 'lotes' && (
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Producto</th>
                                        <th style={{ textAlign: 'right' }}>Cant.</th>
                                        <th style={{ textAlign: 'right' }}>Rechazos</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {data.map((item, i) => (
                                    <tr key={i}>
                                        {tipo === 'pedidos' && (
                                            <>
                                                <td>{new Date(item.fechaEntrega).toLocaleDateString()}</td>
                                                <td>{item.cliente?.nombreComercial}</td>
                                                <td>
                                                    <span className={`badge badge-${item.estado === 'entregado' ? 'success' : 'warning'}`}>
                                                        {item.estado}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>${item.totalImporte.toLocaleString()}</td>
                                            </>
                                        )}
                                        {tipo === 'gastos' && (
                                            <>
                                                <td>{new Date(item.fecha).toLocaleDateString()}</td>
                                                <td>{item.descripcion}</td>
                                                <td>{item.categoria?.nombre}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>${item.monto.toLocaleString()}</td>
                                            </>
                                        )}
                                        {tipo === 'lotes' && (
                                            <>
                                                <td>{new Date(item.fechaProduccion).toLocaleDateString()}</td>
                                                <td>{item.producto?.nombre}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.unidadesProducidas}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>{item.unidadesRechazadas}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div style={{ 
                    padding: 'var(--space-4)', 
                    borderTop: '1px solid var(--color-gray-100)', 
                    textAlign: 'right',
                    backgroundColor: 'var(--color-gray-50)'
                }}>
                    <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    )
}
