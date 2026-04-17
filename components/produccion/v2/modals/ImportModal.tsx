'use client'

import React, { useState } from 'react'
import { useProduccion } from '../ProduccionContext'

interface ImportSummary {
    ok: number
    parcial: number
    error: number
}

function formatDateOnly(isoString: string | null) {
    if (!isoString) return ''
    const d = new Date(isoString)
    return isNaN(d.getTime()) ? isoString : d.toLocaleDateString('es-AR')
}

function getLocalDateString() {
    const tzOffset = new Date().getTimezoneOffset() * 60000
    const localISOTime = new Date(Date.now() - tzOffset).toISOString().slice(0, 10)
    return localISOTime
}

export function ImportModal({ onClose }: { onClose: () => void }) {
    const { filterFecha, setSuccess, setError, mutate } = useProduccion()

    const [importStep, setImportStep] = useState<'upload' | 'preview' | 'done'>('upload')
    const [importMode, setImportMode] = useState<'file' | 'paste'>('file')
    const [importColTurno, setImportColTurno] = useState('')
    const [importColTexto, setImportColTexto] = useState('')
    const [importColFecha, setImportColFecha] = useState('')
    const [importColDestino, setImportColDestino] = useState('')
    const [importHeaders, setImportHeaders] = useState<string[]>([])
    const [importRawRows, setImportRawRows] = useState<any[]>([])
    const [importPreview, setImportPreview] = useState<any[]>([])
    const [importSummary, setImportSummary] = useState<ImportSummary>({ ok: 0, parcial: 0, error: 0 })
    const [importTotalPlanchasElegidos, setImportTotalPlanchasElegidos] = useState(0)
    const [importLoading, setImportLoading] = useState(false)
    const [importTurnosConRuta, setImportTurnosConRuta] = useState<string[]>([])

    async function handleExcelFile(file: File) {
        try {
            const XLSX = await import('xlsx')
            const buffer = await file.arrayBuffer()
            const wb = XLSX.read(buffer, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
            if (!rows.length) { setError('El archivo está vacío.'); return }
            const headers = Object.keys(rows[0])
            setImportHeaders(headers)
            setImportRawRows(rows)
            // Auto-detectar columnas
            const turnoCol = headers.find(h => /turno/i.test(h)) || ''
            const textoCol = headers.find(h => /neces|pedido|prod|item|detalle/i.test(h)) || ''
            const fechaCol = headers.find(h => /fecha|dia|date/i.test(h)) || ''
            setImportColTurno(turnoCol)
            setImportColTexto(textoCol)
            setImportColFecha(fechaCol)
        } catch (err: any) {
            setError('Error al leer el archivo: ' + err.message)
        }
    }

    function handlePasteText(text: string) {
        try {
            // 1. Obtener cabeceras (primera línea no vacía)
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
            if (lines.length < 2) return

            const headers = lines[0].split('\t').map((h, i) => h.trim() || `Columna ${i + 1}`)
            setImportHeaders(headers)

            // 2. Obtener datos
            const rows = lines.slice(1).map(line => {
                const values = line.split('\t')
                const row: any = {}
                headers.forEach((h, idx) => {
                    row[h] = (values[idx] || '').trim()
                })
                return row
            })
            setImportRawRows(rows)

            // Auto-detectar columnas
            const turnoCol = headers.find(h => /turno/i.test(h)) || ''
            const textoCol = headers.find(h => /neces|pedido|prod|item|detalle/i.test(h)) || ''
            const fechaCol = headers.find(h => /fecha|dia|date/i.test(h)) || ''
            setImportColTurno(turnoCol)
            setImportColTexto(textoCol)
            setImportColFecha(fechaCol)
        } catch (err: any) {
            setError('Error al procesar el texto pegado: ' + err.message)
        }
    }

    async function handleImportPreview() {
        if (!importColTurno || !importColTexto) { setError('Seleccioná las columnas de Turno y Necesidades.'); return }
        setImportLoading(true)
        try {
            const filas = importRawRows.map(r => ({
                fechaRaw: importColFecha ? r[importColFecha] : null,
                turno: String(r[importColTurno] || ''),
                texto: String(r[importColTexto] || ''),
                destino: importColDestino ? String(r[importColDestino] || '') : ''
            }))
            const res = await fetch('/api/produccion/planificacion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: filterFecha || getLocalDateString(), filas, confirmar: false })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setImportPreview(data.resultados)
            setImportSummary({ ok: data.ok, parcial: data.parcial, error: data.error })
            setImportTotalPlanchasElegidos(data.totalPlanchasElegidos || 0)
            setImportTurnosConRuta(data.turnosConRuta || [])
            setImportStep('preview')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setImportLoading(false)
        }
    }

    async function handleImportConfirm() {
        setImportLoading(true)
        try {
            const filas = importRawRows.map(r => ({
                fechaRaw: importColFecha ? r[importColFecha] : null,
                turno: String(r[importColTurno] || ''),
                texto: String(r[importColTexto] || ''),
                destino: importColDestino ? String(r[importColDestino] || '') : ''
            }))
            const res = await fetch('/api/produccion/planificacion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: filterFecha || getLocalDateString(), filas, confirmar: true })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setImportStep('done')
            setSuccess(`¡Importación exitosa! ${data.guardados} requerimientos cargados.`)
            mutate()
            setTimeout(() => { onClose(); setSuccess('') }, 3000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setImportLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '640px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>📥 Importar Necesidades</h3>
                    <button className="btn btn-ghost" style={{ fontSize: '1.2rem' }} onClick={onClose}>✕</button>
                </div>

                {importStep === 'upload' && (
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {/* TABS DE MODO */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: 'var(--space-2)' }}>
                            <button
                                onClick={() => setImportMode('file')}
                                style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: importMode === 'file' ? '2px solid #3498DB' : 'none', cursor: 'pointer', fontWeight: importMode === 'file' ? 'bold' : 'normal', color: importMode === 'file' ? '#3498DB' : '#666' }}
                            >📁 Subir Excel</button>
                            <button
                                onClick={() => setImportMode('paste')}
                                style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: importMode === 'paste' ? '2px solid #3498DB' : 'none', cursor: 'pointer', fontWeight: importMode === 'paste' ? 'bold' : 'normal', color: importMode === 'paste' ? '#3498DB' : '#666' }}
                            >📋 Pegar desde Excel</button>
                        </div>

                        {importMode === 'file' ? (
                            <div className="form-group">
                                <label className="form-label">Archivo Excel (.xlsx / .xls)</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="form-input"
                                    onChange={e => { if (e.target.files?.[0]) handleExcelFile(e.target.files[0]) }}
                                />
                            </div>
                        ) : (
                            <div className="form-group">
                                <label className="form-label">Pegar celdas de Excel (incluir encabezados)</label>
                                <textarea
                                    className="form-input"
                                    style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '11px' }}
                                    placeholder={"Ejemplo:\nTurno\tNecesidades\nMañana\t10 48jyq\nSiesta\t5 24jyq"}
                                    onChange={(e) => handlePasteText(e.target.value)}
                                />
                            </div>
                        )}

                        <div style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: '12px', color: 'var(--color-gray-600)' }}>
                            <strong>Formato esperado:</strong><br />
                            Al menos 2 columnas: una para el <strong>Turno</strong> y otra para <strong>Necesidades</strong>.
                        </div>
                        {importHeaders.length > 0 && (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '10px' }}>Columna Fecha</label>
                                        <select className="form-select" value={importColFecha} onChange={e => setImportColFecha(e.target.value)}>
                                            <option key="auto-hoy" value="">(Auto: Hoy)</option>
                                            {importHeaders.map((h, idx) => <option key={`${h}_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '10px' }}>Columna Turno</label>
                                        <select className="form-select" value={importColTurno} onChange={e => setImportColTurno(e.target.value)}>
                                            <option value="">— Seleccionar —</option>
                                            {importHeaders.map((h, idx) => <option key={`${h}_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '10px' }}>Columna Necesidades</label>
                                        <select className="form-select" value={importColTexto} onChange={e => setImportColTexto(e.target.value)}>
                                            <option value="">— Seleccionar —</option>
                                            {importHeaders.map((h, idx) => <option key={`${h}_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '10px' }}>Columna Destino</label>
                                        <select className="form-select" value={importColDestino} onChange={e => setImportColDestino(e.target.value)}>
                                            <option key="auto-destino" value="">(Auto: Fábrica)</option>
                                            {importHeaders.map((h, idx) => <option key={`hdest_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>
                                    {importRawRows.length} filas detectadas. Fecha destino: <strong>{formatDateOnly((filterFecha || getLocalDateString()) + 'T00:00:00')}</strong>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {importStep === 'preview' && (
                    <div className="modal-body">
                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
                            <span className="badge" style={{ background: '#2ECC71', color: '#fff' }}>✅ {importSummary.ok} OK</span>
                            <span className="badge" style={{ background: '#F39C12', color: '#fff' }}>⚠ {importSummary.parcial} Parciales</span>
                            <span className="badge" style={{ background: '#E74C3C', color: '#fff' }}>✕ {importSummary.error} Errores</span>
                            {importTotalPlanchasElegidos > 0 && (
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-primary-50)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--color-primary-200)' }}>
                                    <span style={{ fontSize: '18px' }}>✨</span>
                                    <div style={{ lineHeight: 1 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-primary)' }}>{importTotalPlanchasElegidos} Planchas</div>
                                        <div style={{ fontSize: '9px', color: 'var(--color-primary-600)', textTransform: 'uppercase', fontWeight: 600 }}>Elegidos (Personalizados)</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {importTurnosConRuta.length > 0 && (
                            <div style={{ 
                                background: '#FFF3E0', 
                                border: '1px solid #FFE0B2', 
                                borderRadius: '8px', 
                                padding: '12px 16px', 
                                marginBottom: '15px',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '24px' }}>⚠️</span>
                                <div style={{ fontSize: '12px', color: '#E65100', lineHeight: '1.4' }}>
                                    <strong style={{ fontSize: '13px' }}>Atención: Conflicto con Logística</strong><br />
                                    Ya se han generado hojas de ruta para los turnos: <strong>{importTurnosConRuta.join(', ')}</strong>.
                                    Si confirmas esta importación, los pedidos se <strong>DUPLICARÁN</strong> en el planificador.
                                </div>
                            </div>
                        )}

                        <div className="table-container" style={{ margin: 0, maxHeight: '360px', overflowY: 'auto' }}>
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th style={{ width: '90px' }}>Fecha</th>
                                        <th style={{ width: '90px' }}>Turno</th>
                                        <th style={{ width: '80px' }}>Destino</th>
                                        <th>Texto original</th>
                                        <th>Productos detectados</th>
                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreview.map((r: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{r.fechaValue ? formatDateOnly(r.fechaValue) : '—'}</td>
                                            <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.turnoNorm || <span style={{ color: 'var(--color-danger)' }}>{r.turnoRaw}</span>}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`badge ${r.destino === 'LOCAL' ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                                                    {r.destino}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '11px', color: 'var(--color-gray-500)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.texto}</td>
                                            <td style={{ fontSize: '11px' }}>
                                                {r.items?.length > 0
                                                    ? r.items.map((it: any, itIdx: number) => (
                                                        <span key={`${it.productoId}_${itIdx}`} className="badge badge-info" style={{ marginRight: '2px' }}>
                                                            {it.productoNombre} ×{it.cantidadPaquetes}
                                                        </span>
                                                    ))
                                                    : <span style={{ color: 'var(--color-danger)', fontSize: '10px' }}>{r.errores?.[0] || 'Sin datos'}</span>
                                                }
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {r.status === 'ok' && <span style={{ color: '#2ECC71' }}>✅</span>}
                                                {r.status === 'parcial' && <span style={{ color: '#F39C12' }}>⚠</span>}
                                                {(r.status === 'sin_turno' || r.status === 'sin_match') && <span style={{ color: '#E74C3C' }}>✕</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {importSummary.ok === 0 && importSummary.parcial === 0 && (
                            <div style={{ color: 'var(--color-danger)', marginTop: 'var(--space-2)', fontSize: '12px' }}>
                                No hay filas válidas para importar. Verificá el formato del archivo.
                            </div>
                        )}
                    </div>
                )}

                {importStep === 'done' && (
                    <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                        <div style={{ fontSize: '48px' }}>✅</div>
                        <p style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>¡Importación completada!</p>
                        <p style={{ color: 'var(--color-gray-500)', fontSize: '13px' }}>Los requerimientos ya están cargados en el planificador.</p>
                    </div>
                )}

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
                    {importStep === 'upload' && (
                        <button className="btn btn-primary" onClick={handleImportPreview} disabled={importLoading || !importColTurno || !importColTexto}>
                            {importLoading ? 'Analizando...' : 'Ver Preview →'}
                        </button>
                    )}
                    {importStep === 'preview' && (importSummary.ok > 0 || importSummary.parcial > 0) && (
                        <>
                            <button className="btn btn-ghost" onClick={() => setImportStep('upload')}>← Volver</button>
                            <button className="btn btn-primary" onClick={handleImportConfirm} disabled={importLoading}>
                                {importLoading ? 'Importando...' : `Confirmar (${importSummary.ok + importSummary.parcial} filas)`}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
