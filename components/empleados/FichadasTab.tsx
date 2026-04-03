"use client"

import { useState, useEffect } from 'react'

interface Fichada {
    id: string
    fechaHora: string
    tipo: 'entrada' | 'salida' | 'ausencia'
    origen: string
}

import { agruparFichadasPorDia, calcularResumenDia } from '@/utils/horas'

interface Fichada {
    id: string
    fechaHora: string
    tipo: 'entrada' | 'salida' | 'ausencia'
    origen: string
    tipoLicenciaId?: string
    tipoLicencia?: {
        nombre: string
        conGoceSueldo: boolean
    }
}

export function FichadasTab({ empleadoId, empleado }: { empleadoId: string, empleado: any }) {
    const [fichadas, setFichadas] = useState<Fichada[]>([])
    const [loading, setLoading] = useState(false)
    const [filtroMes, setFiltroMes] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

    // Estados para carga manual
    const [manualOpen, setManualOpen] = useState(false)
    const [manualFecha, setManualFecha] = useState(new Date().toISOString().split('T')[0])
    const [manualHora, setManualHora] = useState('08:00')
    const [manualTipo, setManualTipo] = useState<'entrada' | 'salida' | 'ausencia'>('entrada')
    const [manualTipoLicenciaId, setManualTipoLicenciaId] = useState<string>('')
    const [tiposLicencias, setTiposLicencias] = useState<any[]>([])
    const [manualLoading, setManualLoading] = useState(false)
    const [editingFichadaId, setEditingFichadaId] = useState<string | null>(null)

    const fetchFichadas = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/fichadas?empleadoId=${empleadoId}`)
            const data = await res.json()
            setFichadas(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const fetchTiposLicencias = async () => {
        try {
            const res = await fetch('/api/licencias')
            const data = await res.json()
            setTiposLicencias(data.filter((l: any) => l.activo))
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => {
        fetchFichadas()
        fetchTiposLicencias()
    }, [empleadoId])

    const toggleDay = (day: string) => {
        setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }))
    }

    // Filtrar y agrupar
    const fichadasFiltradas = fichadas.filter(f => f.fechaHora.startsWith(filtroMes))
    const gruposPorDia = agruparFichadasPorDia(fichadasFiltradas)
    const diasOrdenados = Object.keys(gruposPorDia).sort((a, b) => b.localeCompare(a))

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setManualLoading(true)
        try {
            const tempDate = new Date(`${manualFecha}T${manualHora}:00`)

            let res
            if (editingFichadaId) {
                res = await fetch(`/api/fichadas/${editingFichadaId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fechaHora: tempDate.toISOString(),
                        tipo: manualTipo,
                        tipoLicenciaId: manualTipo === 'ausencia' && manualTipoLicenciaId ? manualTipoLicenciaId : null
                    })
                })
            } else {
                res = await fetch('/api/fichadas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        empleadoId,
                        fechaHora: tempDate.toISOString(),
                        tipo: manualTipo,
                        origen: 'manual',
                        tipoLicenciaId: manualTipo === 'ausencia' && manualTipoLicenciaId ? manualTipoLicenciaId : null
                    })
                })
            }

            if (res.ok) {
                setManualOpen(false)
                fetchFichadas()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al guardar fichada')
            }
        } catch (error) {
            console.error(error)
            alert('Error al registrar fichada manual')
        } finally {
            setManualLoading(false)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('¿Seguro que deseas eliminar esta fichada?')) return
        try {
            const res = await fetch(`/api/fichadas/${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchFichadas()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al eliminar')
            }
        } catch (error) {
            console.error(error)
            alert('Error al comunicar con el servidor')
        }
    }

    const openEditModal = (f: Fichada, e: React.MouseEvent) => {
        e.stopPropagation()
        const d = new Date(f.fechaHora)
        const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        setManualFecha(localDate.toISOString().split('T')[0])
        setManualHora(localDate.toISOString().substring(11, 16))
        setManualTipo(f.tipo)
        setManualTipoLicenciaId(f.tipoLicenciaId || '')
        setEditingFichadaId(f.id)
        setManualOpen(true)
    }

    const openCreateModal = () => {
        setManualFecha(new Date().toISOString().split('T')[0])
        setManualHora('08:00')
        setManualTipo('entrada')
        setManualTipoLicenciaId('')
        setEditingFichadaId(null)
        setManualOpen(true)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card">
                <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Historial de Fichadas</h3>
                        <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Asistencia agrupada por día con cálculo de horas.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <div style={{ marginRight: 'var(--space-4)' }}>
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', display: 'block', marginBottom: '2px' }}>Filtrar Mes</label>
                            <input
                                type="month"
                                value={filtroMes}
                                onChange={e => setFiltroMes(e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker?.()}
                                className="form-input"
                                style={{ padding: '4px 8px', height: '36px' }}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            + Carga Manual
                        </button>
                        <button className="btn btn-outline" onClick={fetchFichadas} title="Actualizar">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {diasOrdenados.length > 0 ? (
                    diasOrdenados.map(dia => {
                        const marcas = gruposPorDia[dia]
                        const resumen = calcularResumenDia(marcas, empleado?.horasTrabajoDiarias || 8)
                        const isExpanded = expandedDays[dia]
                        const [yyyy, mm, dd] = dia.split('-')
                        const fechaLegible = `${dd}/${mm}/${yyyy}`

                        return (
                            <div key={dia} className="card" style={{ overflow: 'hidden', borderLeft: resumen.esAusencia ? '4px solid var(--color-danger)' : '4px solid var(--color-primary)' }}>
                                <div
                                    className="card-body"
                                    onClick={() => toggleDay(dia)}
                                    style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 'var(--space-4) var(--space-5)',
                                        backgroundColor: isExpanded ? 'var(--color-gray-50)' : 'transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                        <div style={{
                                            fontSize: 'var(--text-lg)',
                                            fontWeight: 700,
                                            minWidth: '100px'
                                        }}>
                                            {fechaLegible}
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                            {resumen.esAusencia ? (
                                                <span className="badge badge-danger">AUSENCIA</span>
                                            ) : (
                                                <>
                                                    <span className="badge badge-info" style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                                                        ⏱️ {resumen.horasTrabajadas} hs trabajadas
                                                    </span>
                                                    {resumen.horasExtras > 0 && (
                                                        <span className="badge badge-success">
                                                            🚀 {resumen.horasExtras} hs extras
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)' }}>
                                            {marcas.length} marcas
                                        </span>
                                        <svg
                                            width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: '0 var(--space-5) var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-gray-100)' }}>
                                        <table className="table table-sm" style={{ marginTop: 'var(--space-3)' }}>
                                            <thead>
                                                <tr>
                                                    <th>Hora</th>
                                                    <th>Evento</th>
                                                    <th>Origen</th>
                                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {marcas.sort((a: any, b: any) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()).map((f: any) => (
                                                    <tr key={f.id}>
                                                        <td style={{ fontWeight: 600 }}>{new Date(f.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td>
                                                            <span className={`badge ${f.tipo === 'entrada' ? 'badge-success' : f.tipo === 'ausencia' ? 'badge-danger' : 'badge-warning'}`}>
                                                                {f.tipo === 'entrada' ? 'Entrada' : f.tipo === 'ausencia' ? (f.tipoLicencia ? `Ausencia: ${f.tipoLicencia.nombre}` : 'Ausencia') : 'Salida'}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'capitalize' }}>{f.origen}</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                                <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => openEditModal(f, e)} title="Editar">✏️</button>
                                                                <button className="btn btn-icon btn-ghost btn-sm" onClick={(e) => handleDelete(f.id, e)} title="Eliminar">🗑️</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })
                ) : (
                    <div className="empty-state" style={{ padding: 'var(--space-10)', backgroundColor: 'white', borderRadius: 'var(--radius-lg)' }}>
                        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginBottom: 'var(--space-3)', color: 'var(--color-gray-300)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p style={{ color: 'var(--color-gray-500)', textAlign: 'center' }}>No hay fichadas para este mes ({filtroMes}).</p>
                    </div>
                )}
            </div>

            {manualOpen && (
                <div className="modal-overlay" onClick={() => setManualOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{editingFichadaId ? 'Editar Fichada' : 'Registrar Fichada Manual'}</h2>
                            <button onClick={() => setManualOpen(false)} className="btn btn-ghost btn-icon">✕</button>
                        </div>
                        <form onSubmit={handleManualSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input type="date" required value={manualFecha} onChange={e => setManualFecha(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hora</label>
                                    <input type="time" required value={manualHora} onChange={e => setManualHora(e.target.value)} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo de Movimiento</label>
                                    <select value={manualTipo} onChange={e => {
                                        setManualTipo(e.target.value as 'entrada' | 'salida' | 'ausencia')
                                        if (e.target.value !== 'ausencia') setManualTipoLicenciaId('')
                                    }} className="form-select">
                                        <option value="entrada">Entrada</option>
                                        <option value="salida">Salida</option>
                                        <option value="ausencia">Ausencia Confirmada</option>
                                    </select>
                                </div>
                                {manualTipo === 'ausencia' && (
                                    <div className="form-group">
                                        <label className="form-label">Motivo (Opcional)</label>
                                        <select value={manualTipoLicenciaId} onChange={e => setManualTipoLicenciaId(e.target.value)} className="form-select">
                                            <option value="">-- Sin especificar --</option>
                                            {tiposLicencias.map(l => (
                                                <option key={l.id} value={l.id}>{l.nombre} {l.conGoceSueldo ? '(Remunerada)' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setManualOpen(false)} className="btn btn-ghost">Cancelar</button>
                                <button type="submit" disabled={manualLoading} className="btn btn-primary">
                                    {manualLoading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
