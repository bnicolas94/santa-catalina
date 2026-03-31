// components/produccion/v2/sections/ProductionLotsTable.tsx
'use client'

import React from 'react'
import { Lote, getEstadoInfo } from '../types'

interface ProductionLotsTableProps {
    lotes: Lote[]
    onEdit: (lote: Lote) => void
    onDelete: (lote: Lote) => void
}

export const ProductionLotsTable: React.FC<ProductionLotsTableProps> = ({ lotes, onEdit, onDelete }) => {
    return (
        <div className="table-container">
            <table className="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Producto</th>
                        <th>Fecha</th>
                        <th>Horario</th>
                        <th>Personal</th>
                        <th>Coordinador</th>
                        <th>Paquetes</th>
                        <th>Ubicación</th>
                        <th>Estado</th>
                        <th style={{ width: 100 }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {lotes.length === 0 ? (
                        <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>No se encontraron lotes para este filtro</td></tr>
                    ) : lotes.map((l) => {
                        const est = getEstadoInfo(l.estado)
                        return (
                            <tr key={l.id}>
                                <td style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gray-500)' }}>{l.id}</td>
                                <td style={{ fontWeight: 600 }}>{l.producto.nombre} <span style={{ color: 'var(--color-primary)', fontSize: '0.8rem' }}>[{l.producto.codigoInterno}]</span></td>
                                <td style={{ fontSize: '0.85rem' }}>{new Date(l.fechaProduccion).toLocaleDateString('es-AR')}</td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>
                                    {l.horaInicio ? new Date(l.horaInicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    {l.horaFin ? ` a ${new Date(l.horaFin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                </td>
                                <td style={{ textAlign: 'center' }}>{l.empleadosRonda}</td>
                                <td style={{ fontSize: '0.85rem' }}>{l.coordinador?.nombre || '—'}</td>
                                <td style={{ fontWeight: 700, textAlign: 'center' }}>{l.unidadesProducidas}</td>
                                <td style={{ fontSize: '0.85rem' }}>
                                    <span className="badge" style={{ backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-700)' }}>
                                        {l.ubicacion?.nombre || '—'}
                                    </span>
                                </td>
                                <td>
                                    <span className="badge" style={{ backgroundColor: `${est.color}20`, color: est.color, border: `1px solid ${est.color}40`, fontWeight: 600 }}>
                                        {est.emoji} {est.label}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-sm" title="Editar / Cerrar" onClick={() => onEdit(l)}>✏️</button>
                                        <button className="btn btn-ghost btn-danger btn-sm" title="Eliminar" onClick={() => onDelete(l)}>🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
