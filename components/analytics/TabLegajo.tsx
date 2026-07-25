'use client'

import { useState, Fragment } from 'react'
import { getPrintLogos } from '@/lib/utils/printLogos'
import type { AnalyticsData, AnalyticsSancion } from './analytics.types'
import { ESTADOS_ASISTENCIA, escaparHtml, formatearFechaCivil, textoEstadoAsistencia, tonoEstadoAsistencia } from './legajo.utils'
import { LegajoSummary } from './LegajoSummary'

interface TabLegajoProps {
    data: AnalyticsData
    onRefresh?: () => void
}

export default function TabLegajo({ data, onRefresh }: TabLegajoProps) {
    const [expandedHistorico, setExpandedHistorico] = useState<string | null>(null)
    const [updatingDate, setUpdatingDate] = useState<string | null>(null)
    
    // Estados para selección múltiple
    const [selectedDates, setSelectedDates] = useState<string[]>([])
    const [isBulkUpdating, setIsBulkUpdating] = useState(false)
    const [bulkStatus, setBulkStatus] = useState('')

    // Estados para nueva sanción
    const [showNewSancion, setShowNewSancion] = useState(false)
    const [isSubmittingSancion, setIsSubmittingSancion] = useState(false)
    const [newSancion, setNewSancion] = useState({
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'APERCIBIMIENTO',
        motivo: '',
        observaciones: ''
    })

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
    const asistenciaDiaria = h.asistenciaDiaria || []

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
        } catch (error: unknown) {
            alert('Error: ' + (error instanceof Error ? error.message : 'No se pudo actualizar la asistencia'))
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
            setSelectedDates(asistenciaDiaria.map(d => d.fecha))
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
        } catch (error: unknown) {
            alert('Error al aplicar cambios masivos: ' + (error instanceof Error ? error.message : 'Error desconocido'))
        } finally {
            setIsBulkUpdating(false)
        }
    }

    const handleSubmitSancion = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmittingSancion(true)
        try {
            const res = await fetch('/api/empleados/sanciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newSancion, empleadoId: h.empleado.id })
            })
            if (!res.ok) throw new Error('Error al guardar la sanción')
            
            setNewSancion({
                fecha: new Date().toISOString().split('T')[0],
                tipo: 'APERCIBIMIENTO',
                motivo: '',
                observaciones: ''
            })
            setShowNewSancion(false)
            if (onRefresh) await onRefresh()
        } catch (error) {
            console.error(error)
            alert('Error al guardar la sanción')
        } finally {
            setIsSubmittingSancion(false)
        }
    }

    const handlePrintSancion = async (sancion: AnalyticsSancion) => {
        const dImp = new Date(sancion.fecha)
        // Add timezone offset to display correct day (since it's saved as YYYY-MM-DDT00:00:00Z)
        const localDImp = new Date(dImp.getTime() + dImp.getTimezoneOffset() * 60000)
        const dia = localDImp.getDate()
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        const mesNombre = meses[localDImp.getMonth()]
        const anio = localDImp.getFullYear()

        const { logo: logoBase64 } = await getPrintLogos()

        const html = `
            <html>
            <head>
                <title>Documento de ${sancion.tipo}</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm; }
                    body { font-family: 'Times New Roman', Times, serif; line-height: 1.4; color: #000; font-size: 12pt; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 15px; }
                    .logo { font-size: 20pt; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
                    .doc-title { font-size: 16pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin-top: 10px; }
                    .content { margin-top: 20px; text-align: justify; }
                    .date { text-align: right; margin-bottom: 20px; }
                    .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
                    .signature-box { border-top: 1px solid #000; width: 250px; text-align: center; padding-top: 10px; }
                    .footer { margin-top: 40px; font-size: 10pt; color: #555; border-top: 1px dashed #ccc; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoBase64}" style="height: 60px; margin-bottom: 10px;" />
                    <div style="font-size: 10pt;">Gestión de Recursos Humanos</div>
                    <div class="doc-title">${sancion.tipo}</div>
                </div>

                <div class="date">
                    Berazategui, ${dia} de ${mesNombre} de ${anio}
                </div>

                <div class="content">
                    <p>Por medio de la presente, se notifica formalmente al Sr./Sra. <strong>${escaparHtml(h.empleado.nombre)} ${escaparHtml(h.empleado.apellido)}</strong>,
                    con DNI <strong>${escaparHtml(h.empleado.dni || '________')}</strong>, que se ha resuelto aplicar la siguiente medida disciplinaria:
                    <strong>${escaparHtml(sancion.tipo)}</strong>.</p>

                    <p><strong>Motivo de la medida:</strong><br/>
                    ${escaparHtml(sancion.motivo)}</p>

                    ${sancion.observaciones ? `
                        <p><strong>Observaciones:</strong><br/>
                        ${escaparHtml(sancion.observaciones)}</p>
                    ` : ''}

                    <p>Se deja constancia de que esta medida quedará registrada en el legajo personal. Se insta a evitar futuras inconductas similares, bajo apercibimiento de aplicar sanciones mayores.</p>
                </div>

                <div class="signature-section">
                    <div class="signature-box">
                        <br/><br/><br/>
                        Firma de la Empresa<br/>
                        Aclaración
                    </div>
                    <div class="signature-box">
                        <br/><br/><br/>
                        Firma del Empleado/a<br/>
                        Aclaración / DNI
                    </div>
                </div>

                <div class="footer">
                    Generado el ${new Date().toLocaleDateString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}<br/>
                    ID de Registro: ${escaparHtml(sancion.id)}
                </div>
            </body>
            </html>
        `

        const printWindow = window.open('', '_blank')
        if (printWindow) {
            printWindow.document.write(html)
            printWindow.document.close()
            setTimeout(() => {
                printWindow.print()
            }, 500)
        }
    }

    const exportToCSV = () => {
        if (asistenciaDiaria.length === 0) return

        const headers = ['Fecha', 'Dia', 'Estado', 'Entrada', 'Salida', 'Hs Trabajadas', 'Detalle/Motivo']
        const rows = asistenciaDiaria.map(d => [
            formatearFechaCivil(d.fecha),
            d.diaSemana,
            textoEstadoAsistencia(d.status),
            d.entrada || '',
            d.salida || '',
            d.horasTrabajadas || '0',
            d.nombreFeriado || d.motivoInasistencia || ''
        ])

        const csvContent = "\uFEFF" // UTF-8 BOM para soporte correcto de caracteres especiales en Excel en Español
            + [headers.join(';'), ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(';'))].join('\n')

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
        URL.revokeObjectURL(url)
    }

    return (
        <div>
            <LegajoSummary historico={h} />
            <nav style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', padding: '6px', background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }} aria-label="Secciones del legajo">
                <a className="btn btn-ghost" href="#legajo-asistencia">Asistencia</a>
                <a className="btn btn-ghost" href="#legajo-liquidaciones">Liquidaciones</a>
                <a className="btn btn-ghost" href="#legajo-sanciones">Sanciones</a>
            </nav>

            {/* Control de Asistencia Diario */}
            <div id="legajo-asistencia" className="card shadow-sm" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)', scrollMarginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <div>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: '2px' }}>
                            Control de asistencia diario
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
                                        {ESTADOS_ASISTENCIA.map(estado => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
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
                                asistenciaDiaria.map(d => {
                                    const statusStyle = tonoEstadoAsistencia(d.status)
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
                                                {d.diaSemana} {formatearFechaCivil(d.fecha)}
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
                                                    {textoEstadoAsistencia(d.status)}
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
                                                        {ESTADOS_ASISTENCIA.map(estado => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
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
            <div id="legajo-liquidaciones" className="card shadow-sm" style={{ padding: 'var(--space-6)', scrollMarginTop: '20px' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                    Historial de liquidaciones — {h.empleado?.nombre} {h.empleado?.apellido || ''}
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
                            ) : h.semanas.map(s => (
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
                                                        {s.desglose.map(dia => (
                                                            <div key={dia.fecha} style={{ backgroundColor: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: `1px solid ${dia.esFeriado ? '#f59e0b' : dia.horasTrabajadas > 0 ? 'var(--color-gray-200)' : dia.esJustificado ? '#10b981' : '#ef4444'}`, fontSize: '11px', opacity: dia.horasTrabajadas > 0 || dia.esJustificado ? 1 : 0.6 }}>
                                                                <div style={{ fontWeight: 700, borderBottom: '1px solid var(--color-gray-100)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span>{dia.diaSemana?.substring(0, 3)} {dia.fecha?.split('-')[2]}</span>
                                                                    {dia.esFeriado && <span>🚩</span>}
                                                                    {dia.esJustificado && <span style={{ color: '#10b981', fontSize: '9px' }}>✓M</span>}
                                                                </div>
                                                                <div>{dia.entrada || '--:--'} a {dia.salida || '--:--'}</div>
                                                                <div style={{ color: 'var(--color-gray-500)' }}>HS: {dia.horasTrabajadas} {(dia.horasExtras || 0) > 0 && <span style={{ color: 'var(--color-success)' }}>(+{dia.horasExtras})</span>}</div>
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

            {/* Registro de Sanciones */}
            <div id="legajo-sanciones" className="card shadow-sm" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)', scrollMarginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
                        Registro de sanciones y apercibimientos
                    </h3>
                    <button 
                        className="btn btn-primary"
                        onClick={() => setShowNewSancion(!showNewSancion)}
                        style={{ padding: '6px 12px', fontSize: 'var(--text-sm)' }}
                    >
                        {showNewSancion ? '✕ Cancelar' : '+ Registrar Sanción'}
                    </button>
                </div>

                {showNewSancion && (
                    <form onSubmit={handleSubmitSancion} style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-gray-200)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">Fecha</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={newSancion.fecha}
                                    onChange={e => setNewSancion({...newSancion, fecha: e.target.value})}
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo de Medida</label>
                                <select 
                                    className="form-select"
                                    value={newSancion.tipo}
                                    onChange={e => setNewSancion({...newSancion, tipo: e.target.value})}
                                    required
                                >
                                    <option value="APERCIBIMIENTO">Apercibimiento / Llamado de Atención</option>
                                    <option value="SANCION">Sanción Disciplinaria</option>
                                    <option value="SUSPENSION">Suspensión</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">Motivo (se imprimirá en el documento)</label>
                            <textarea 
                                className="form-input" 
                                rows={2}
                                value={newSancion.motivo}
                                onChange={e => setNewSancion({...newSancion, motivo: e.target.value})}
                                placeholder="Describa claramente la inconducta o motivo..."
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">Observaciones Internas (opcional)</label>
                            <textarea 
                                className="form-input" 
                                rows={2}
                                value={newSancion.observaciones}
                                onChange={e => setNewSancion({...newSancion, observaciones: e.target.value})}
                                placeholder="Notas internas que no saldrán en la impresión..."
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                                disabled={isSubmittingSancion}
                            >
                                {isSubmittingSancion ? 'Guardando...' : 'Guardar y Emitir'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Motivo</th>
                                <th>Observaciones</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(!h.listaSanciones || h.listaSanciones.length === 0) ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay sanciones registradas en el legajo de este empleado.
                                    </td>
                                </tr>
                            ) : (
                                h.listaSanciones.map(s => (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600 }}>{formatearFechaCivil(s.fecha)}</td>
                                        <td>
                                            <span style={{ 
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-full)',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                backgroundColor: s.tipo === 'SUSPENSION' ? '#fee2e2' : s.tipo === 'SANCION' ? '#fce8e6' : '#fffbeb',
                                                color: s.tipo === 'SUSPENSION' ? '#991b1b' : s.tipo === 'SANCION' ? '#c5221f' : '#b45309',
                                                border: `1px solid ${s.tipo === 'SUSPENSION' ? '#fecaca' : s.tipo === 'SANCION' ? '#fad2cf' : '#fde68a'}`
                                            }}>
                                                {s.tipo}
                                            </span>
                                        </td>
                                        <td>{s.motivo}</td>
                                        <td style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>{s.observaciones || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button 
                                                className="btn btn-outline"
                                                onClick={() => handlePrintSancion(s)}
                                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                                title="Imprimir Documento"
                                            >
                                                🖨️ Imprimir
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
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
