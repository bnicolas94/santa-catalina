'use client'

import { useState, Fragment } from 'react'

interface TabLegajoProps {
    data: any
    onRefresh?: () => void
}

export default function TabLegajo({ data, onRefresh }: TabLegajoProps) {
    const [expandedHistorico, setExpandedHistorico] = useState<string | null>(null)
    const [updatingDate, setUpdatingDate] = useState<string | null>(null)
    
    // Estados para selección múltiple
    const [selectedDates, setSelectedDates] = useState<string[]>([])
    const [isBulkUpdating, setIsBulkUpdating] = useState(false)
    const [bulkStatus, setBulkStatus] = useState('')

    if (!data.historico) {
        return (
            <div className="card shadow-sm" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-4)' }}>👤</div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-gray-600)', marginBottom: 'var(--space-2)' }}>Legajo Individual</h3>
                <p style={{ color: 'var(--color-gray-400)' }}>Seleccioná un empleado del filtro superior para ver su legajo individual.</p>
            </div>
        )
    }

    const h = data.historico
    const kpis = h.kpis
    const asistenciaDiaria = h.asistenciaDiaria || []

    const formatFecha = (fechaStr: string) => {
        if (!fechaStr) return ''
        const parts = fechaStr.split('-')
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`
        }
        return fechaStr
    }

    const mapStatusText = (status: string) => {
        switch (status) {
            case 'TRABAJO': return 'Trabajó'
            case 'FRANCO': return 'Franco'
            case 'FERIADO': return 'Feriado'
            case 'ENFERMEDAD': return 'Enfermedad'
            case 'SIN_AVISO': return 'Ausente Sin Aviso'
            case 'CON_AVISO': return 'Ausente Con Aviso'
            default: return status
        }
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'TRABAJO':
                return { backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #ceead6' }
            case 'FRANCO':
                return { backgroundColor: '#f1f3f4', color: '#5f6368', border: '1px solid #dadce0' }
            case 'FERIADO':
                return { backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
            case 'ENFERMEDAD':
                return { backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff' }
            case 'SIN_AVISO':
                return { backgroundColor: '#fce8e6', color: '#c5221f', border: '1px solid #fad2cf' }
            case 'CON_AVISO':
                return { backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }
            default:
                return { backgroundColor: '#f1f3f4', color: '#5f6368', border: '1px solid #dadce0' }
        }
    }

    // Manejador para cambiar estado de un solo día
    const handleStatusChange = async (fecha: string, newStatus: string) => {
        setUpdatingDate(fecha)
        try {
            const response = await fetch('/api/empleados/asistencia-diaria', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    empleadoId: h.empleado.id,
                    fecha,
                    status: newStatus,
                }),
            })

            if (!response.ok) {
                const errJson = await response.json()
                throw new Error(errJson.error || 'Error al actualizar asistencia')
            }

            // Recargar datos principales del panel
            if (onRefresh) {
                await onRefresh()
            }
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setUpdatingDate(null)
        }
    }

    // Manejadores para selección múltiple
    const handleSelectDate = (fecha: string) => {
        setSelectedDates(prev => {
            if (prev.includes(fecha)) {
                return prev.filter(f => f !== fecha)
            } else {
                return [...prev, fecha]
            }
        })
    }

    const handleSelectAll = () => {
        if (selectedDates.length === asistenciaDiaria.length) {
            setSelectedDates([])
        } else {
            setSelectedDates(asistenciaDiaria.map((d: any) => d.fecha))
        }
    }

    const handleBulkAction = async () => {
        if (!bulkStatus) return
        if (selectedDates.length === 0) return

        setIsBulkUpdating(true)
        try {
            const response = await fetch('/api/empleados/asistencia-diaria', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    empleadoId: h.empleado.id,
                    fechas: selectedDates,
                    status: bulkStatus,
                }),
            })

            if (!response.ok) {
                const errJson = await response.json()
                throw new Error(errJson.error || 'Error al aplicar cambios masivos')
            }

            // Limpiar selección y estado
            setSelectedDates([])
            setBulkStatus('')

            // Recargar datos principales del panel
            if (onRefresh) {
                await onRefresh()
            }
        } catch (error: any) {
            alert('Error al aplicar cambios masivos: ' + error.message)
        } finally {
            setIsBulkUpdating(false)
        }
    }

    const exportToCSV = () => {
        if (asistenciaDiaria.length === 0) return

        const headers = ['Fecha', 'Dia', 'Estado', 'Entrada', 'Salida', 'Hs Trabajadas', 'Detalle/Motivo']
        const rows = asistenciaDiaria.map((d: any) => [
            formatFecha(d.fecha),
            d.diaSemana,
            mapStatusText(d.status),
            d.entrada || '',
            d.salida || '',
            d.horasTrabajadas || '0',
            d.nombreFeriado || d.motivoInasistencia || ''
        ])

        const csvContent = "\uFEFF" // UTF-8 BOM para soporte correcto de caracteres especiales en Excel en Español
            + [headers.join(';'), ...rows.map((row: any[]) => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(';'))].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const nombreArchivo = `asistencia_${h.empleado?.nombre}_${h.empleado?.apellido || ''}_${new Date().toISOString().split('T')[0]}.csv`.toLowerCase()
        link.setAttribute('href', url)
        link.setAttribute('download', nombreArchivo)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Neto Acumulado</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-success)' }}>${kpis.totalNeto.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{kpis.cantidadLiquidaciones} liquidaciones</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Promedio Semanal</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>${kpis.promedioNetoPorLiquidacion.toLocaleString()}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Hs Extras Totales</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#f59e0b' }}>{kpis.totalHsExtras} hs</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Acumulado: ${kpis.totalMontoHsExtras?.toLocaleString() || 0}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Días Ausentes</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: kpis.totalDiasAusentes > 0 ? 'var(--color-danger)' : 'inherit' }}>{kpis.totalDiasAusentes}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{kpis.totalDiasJustificados} justificados</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Días Trabajados</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{kpis.totalDiasTrabajados}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #06b6d4' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Puntualidad</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: kpis.puntualidad >= 90 ? 'var(--color-success)' : kpis.puntualidad >= 70 ? '#f59e0b' : 'var(--color-danger)' }}>
                        {kpis.puntualidad}%
                    </div>
                </div>
                {kpis.sanciones > 0 && (
                    <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #7c3aed' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Sanciones</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#7c3aed' }}>{kpis.sanciones}</div>
                    </div>
                )}
                {kpis.deudaPendiente > 0 && (
                    <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid var(--color-danger)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Deuda Préstamos</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-danger)' }}>${kpis.deudaPendiente.toLocaleString()}</div>
                    </div>
                )}
            </div>

            {/* Control de Asistencia Diario */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <div>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: '2px' }}>
                            📅 Control de Asistencia Diario
                        </h3>
                        <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)', margin: 0 }}>
                            Registrá justificaciones, enfermedades o ausencias de forma individual o masiva.
                        </p>
                    </div>
                    <button
                        className="btn btn-outline"
                        onClick={exportToCSV}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', padding: '6px 12px' }}
                    >
                        📥 Exportar Reporte Contador (CSV)
                    </button>
                </div>

                {/* Barra de Acciones Masivas */}
                {selectedDates.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#eef2ff', // color primary light
                        border: '1px solid #4f46e5', // color primary
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: 'var(--space-4)',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#4f46e5' }}>
                                🗹 {selectedDates.length} {selectedDates.length === 1 ? 'día seleccionado' : 'días seleccionados'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            {isBulkUpdating ? (
                                <span style={{ fontSize: 'var(--text-xs)', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="spinner-small"></span> Aplicando cambios masivos...
                                </span>
                            ) : (
                                <>
                                    <select
                                        value={bulkStatus}
                                        onChange={(e) => setBulkStatus(e.target.value)}
                                        className="form-select"
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: 'var(--text-xs)',
                                            width: 'auto',
                                            height: 'auto',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">-- Seleccionar estado a aplicar --</option>
                                        <option value="TRABAJO">🟢 Trabajó / Presente</option>
                                        <option value="FRANCO">⚪ Franco</option>
                                        <option value="FERIADO">🚩 Feriado</option>
                                        <option value="ENFERMEDAD">🟣 Enfermedad</option>
                                        <option value="SIN_AVISO">🔴 Sin Aviso</option>
                                        <option value="CON_AVISO">🟠 Con Aviso</option>
                                    </select>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleBulkAction}
                                        disabled={!bulkStatus}
                                        style={{ padding: '6px 12px', fontSize: 'var(--text-xs)' }}
                                    >
                                        Aplicar Acción Masiva
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => {
                                            setSelectedDates([])
                                            setBulkStatus('')
                                        }}
                                        style={{ padding: '6px 12px', fontSize: 'var(--text-xs)' }}
                                    >
                                        Cancelar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={asistenciaDiaria.length > 0 && selectedDates.length === asistenciaDiaria.length} 
                                        onChange={handleSelectAll}
                                        disabled={updatingDate !== null || isBulkUpdating}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </th>
                                <th>Fecha y Día</th>
                                <th style={{ textAlign: 'center' }}>Horario Fichado</th>
                                <th style={{ textAlign: 'center' }}>Horas Trab.</th>
                                <th style={{ textAlign: 'left' }}>Detalle del Día</th>
                                <th style={{ textAlign: 'center' }}>Estado Actual</th>
                                <th style={{ textAlign: 'right' }}>Modificar Asistencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {asistenciaDiaria.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay registros de asistencia para el rango de fechas seleccionado.
                                    </td>
                                </tr>
                            ) : (
                                asistenciaDiaria.map((d: any) => {
                                    const statusStyle = getStatusStyle(d.status)
                                    const isChecked = selectedDates.includes(d.fecha)
                                    return (
                                        <tr key={d.fecha} style={{ verticalAlign: 'middle', backgroundColor: isChecked ? '#f8fafc' : 'transparent' }}>
                                            <td style={{ width: '40px', textAlign: 'center' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked} 
                                                    onChange={() => handleSelectDate(d.fecha)}
                                                    disabled={updatingDate !== null || isBulkUpdating}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                {d.diaSemana} {formatFecha(d.fecha)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {d.entrada && d.salida ? (
                                                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-700)' }}>
                                                        {d.entrada} a {d.salida}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--text-xs)' }}>-- : --</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: d.horasTrabajadas > 0 ? 600 : 'normal' }}>
                                                {d.horasTrabajadas > 0 ? `${d.horasTrabajadas} hs` : '--'}
                                            </td>
                                            <td style={{ textAlign: 'left' }}>
                                                {d.esFeriado && (
                                                    <span style={{ color: '#b45309', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                                                        🚩 Feriado: {d.nombreFeriado || 'Nacional'}
                                                    </span>
                                                )}
                                                {d.status === 'FRANCO' && (
                                                    <span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)' }}>
                                                        Día Franco
                                                    </span>
                                                )}
                                                {d.status === 'ENFERMEDAD' && (
                                                    <span style={{ color: '#6b21a8', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                                                        🩹 Carpeta Médica (Justificado)
                                                    </span>
                                                )}
                                                {d.status === 'CON_AVISO' && (
                                                    <span style={{ color: '#c2410c', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                                                        ✉️ Ausente con aviso
                                                    </span>
                                                )}
                                                {d.status === 'SIN_AVISO' && (
                                                    <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                                                        🚨 Falta Injustificada
                                                    </span>
                                                )}
                                                {d.status === 'TRABAJO' && !d.entrada && !d.esFeriado && !d.esFranco && (
                                                    <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--text-xs)' }}>
                                                        Día hábil sin fichadas
                                                    </span>
                                                )}
                                                {d.status === 'TRABAJO' && d.entrada && (
                                                    <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-xs)' }}>
                                                        Jornada normal registrada
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '3px 8px',
                                                        borderRadius: 'var(--radius-full)',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase',
                                                        ...statusStyle
                                                    }}
                                                >
                                                    {mapStatusText(d.status)}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {updatingDate === d.fecha ? (
                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                                        <span className="spinner-small"></span> Guardando...
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={d.status}
                                                        onChange={(e) => handleStatusChange(d.fecha, e.target.value)}
                                                        disabled={isBulkUpdating}
                                                        className="form-select"
                                                        style={{
                                                            padding: '4px 8px',
                                                            fontSize: 'var(--text-xs)',
                                                            width: 'auto',
                                                            display: 'inline-block',
                                                            height: 'auto',
                                                            borderRadius: 'var(--radius-md)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="TRABAJO">🟢 Trabajó / Presente</option>
                                                        <option value="FRANCO">⚪ Franco</option>
                                                        <option value="FERIADO">🚩 Feriado</option>
                                                        <option value="ENFERMEDAD">🟣 Enfermedad</option>
                                                        <option value="SIN_AVISO">🔴 Sin Aviso</option>
                                                        <option value="CON_AVISO">🟠 Con Aviso</option>
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Historial de Liquidaciones */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                    📋 Historial de Liquidaciones — {h.empleado?.nombre} {h.empleado?.apellido || ''}
                </h3>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Periodo</th>
                                <th style={{ textAlign: 'center' }}>Días Trab.</th>
                                <th style={{ textAlign: 'center' }}>Ausencias</th>
                                <th style={{ textAlign: 'center' }}>Justif.</th>
                                <th style={{ textAlign: 'center' }}>Hs Extras</th>
                                <th style={{ textAlign: 'right' }}>Base</th>
                                <th style={{ textAlign: 'right' }}>Extras</th>
                                <th style={{ textAlign: 'right' }}>Desc.</th>
                                <th style={{ textAlign: 'right', fontWeight: 800 }}>Neto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {h.semanas.length === 0 ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>No hay liquidaciones registradas.</td></tr>
                            ) : h.semanas.map((s: any) => (
                                <Fragment key={s.id}>
                                    <tr onClick={() => setExpandedHistorico(expandedHistorico === s.id ? null : s.id)} style={{ cursor: 'pointer', backgroundColor: expandedHistorico === s.id ? 'var(--color-info-bg)' : 'transparent' }}>
                                        <td>{expandedHistorico === s.id ? '▼' : '▶'}</td>
                                        <td style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{s.periodo}</td>
                                        <td style={{ textAlign: 'center' }}>{s.diasTrabajados}/{s.diasLaborales}</td>
                                        <td style={{ textAlign: 'center', color: s.diasAusentes > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>{s.diasAusentes}</td>
                                        <td style={{ textAlign: 'center', color: s.diasJustificados > 0 ? '#f59e0b' : 'inherit' }}>{s.diasJustificados}</td>
                                        <td style={{ textAlign: 'center', color: s.hsExtras > 0 ? 'var(--color-success)' : 'inherit' }}>{s.hsExtras}h</td>
                                        <td style={{ textAlign: 'right' }}>${s.sueldoBase.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>${s.montoExtras.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>-${s.descuentos.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>${s.neto.toLocaleString()}</td>
                                    </tr>
                                    {expandedHistorico === s.id && s.desglose?.length > 0 && (
                                        <tr>
                                            <td colSpan={10} style={{ padding: 0, background: 'var(--color-gray-50)' }}>
                                                <div style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
                                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-gray-500)', fontWeight: 800, marginBottom: 'var(--space-3)' }}>Desglose Día por Día</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)' }}>
                                                        {s.desglose.map((dia: any) => (
                                                            <div key={dia.fecha} style={{ backgroundColor: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: `1px solid ${dia.esFeriado ? '#f59e0b' : dia.horasTrabajadas > 0 ? 'var(--color-gray-200)' : dia.esJustificado ? '#10b981' : '#ef4444'}`, fontSize: '11px', opacity: dia.horasTrabajadas > 0 || dia.esJustificado ? 1 : 0.6 }}>
                                                                <div style={{ fontWeight: 700, borderBottom: '1px solid var(--color-gray-100)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span>{dia.diaSemana?.substring(0, 3)} {dia.fecha?.split('-')[2]}</span>
                                                                    {dia.esFeriado && <span>🚩</span>}
                                                                    {dia.esJustificado && <span style={{ color: '#10b981', fontSize: '9px' }}>✓M</span>}
                                                                </div>
                                                                <div>{dia.entrada || '--:--'} a {dia.salida || '--:--'}</div>
                                                                <div style={{ color: 'var(--color-gray-500)' }}>HS: {dia.horasTrabajadas} {dia.horasExtras > 0 && <span style={{ color: 'var(--color-success)' }}>(+{dia.horasExtras})</span>}</div>
                                                                <div style={{ fontWeight: 600, textAlign: 'right' }}>${dia.totalDia?.toLocaleString()}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx>{`
                .spinner-small {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(0,0,0,.1);
                    border-radius: 50%;
                    border-top-color: var(--color-primary);
                    animation: spin-anim 0.6s linear infinite;
                }
                @keyframes spin-anim {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
