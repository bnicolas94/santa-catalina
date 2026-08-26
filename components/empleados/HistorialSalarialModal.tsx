'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type EmpleadoOpcion = { id: string; nombre: string; apellido?: string | null }

type CambioSalarial = {
    id: string
    origen: 'EMPLEADO' | 'ROL'
    montoAnterior: number
    montoNuevo: number
    cicloPagoAnterior: string
    cicloPagoNuevo: string
    valorHoraExtraAnterior: number
    valorHoraExtraNuevo: number
    fuenteAnterior?: string | null
    fuenteNueva?: string | null
    fechaVigencia: string
    empleado?: { id: string; nombre: string; apellido?: string | null; dni?: string | null } | null
    rol?: { id: string; nombre: string } | null
    registradoPor?: { id: string; nombre: string; apellido?: string | null } | null
}

const dinero = (value: number) => `$${Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
const nombreCompleto = (persona?: { nombre: string; apellido?: string | null } | null) => persona
    ? `${persona.nombre} ${persona.apellido || ''}`.trim()
    : 'Sin identificar'

function fechaHora(value: string) {
    return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(value))
}

function variacion(cambio: CambioSalarial) {
    if (cambio.montoAnterior <= 0 || cambio.montoNuevo <= cambio.montoAnterior) return null
    return ((cambio.montoNuevo - cambio.montoAnterior) / cambio.montoAnterior) * 100
}

export function HistorialSalarialModal({ empleados, onClose }: { empleados: EmpleadoOpcion[]; onClose: () => void }) {
    const [historial, setHistorial] = useState<CambioSalarial[]>([])
    const [empleadoId, setEmpleadoId] = useState('')
    const [origen, setOrigen] = useState('')
    const [desde, setDesde] = useState('')
    const [hasta, setHasta] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const cargar = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams()
            if (empleadoId) params.set('empleadoId', empleadoId)
            if (origen) params.set('origen', origen)
            if (desde) params.set('desde', desde)
            if (hasta) params.set('hasta', hasta)
            const res = await fetch(`/api/empleados/historial-salarial?${params.toString()}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo cargar el historial.')
            setHistorial(Array.isArray(data.historial) ? data.historial : [])
        } catch (err) {
            setHistorial([])
            setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
        } finally {
            setLoading(false)
        }
    }, [desde, empleadoId, hasta, origen])

    useEffect(() => {
        void cargar()
    }, [cargar])

    const resumen = useMemo(() => ({
        cambios: historial.length,
        aumentos: historial.filter(cambio => cambio.montoNuevo > cambio.montoAnterior).length,
        empleados: new Set(historial.map(cambio => cambio.empleado?.id).filter(Boolean)).size,
    }), [historial])

    const limpiar = () => {
        setEmpleadoId('')
        setOrigen('')
        setDesde('')
        setHasta('')
    }

    return <div className="modal-overlay" onMouseDown={onClose}>
        <div className="modal" onMouseDown={event => event.stopPropagation()} style={{ width: 'min(1180px, 96vw)', maxWidth: 1180, maxHeight: '92vh' }}>
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
                <div>
                    <div style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Auditoría de nómina</div>
                    <h2 style={{ margin: '4px 0 3px' }}>Historial salarial</h2>
                    <p style={{ margin: 0, color: 'var(--color-gray-500)' }}>Consultá cuándo cambió cada sueldo, qué valor tenía y quién realizó la modificación.</p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-gray-50)' }}>
                    {[
                        ['Cambios registrados', resumen.cambios],
                        ['Aumentos', resumen.aumentos],
                        ['Empleados alcanzados', resumen.empleados],
                    ].map(([label, value]) => <div key={String(label)} style={{ padding: '17px 22px', borderRight: '1px solid var(--color-gray-200)' }}>
                        <strong style={{ color: 'var(--color-primary)', fontSize: 25 }}>{value}</strong>
                        <span style={{ marginLeft: 9, color: 'var(--color-gray-600)', fontSize: 13 }}>{label}</span>
                    </div>)}
                </div>

                <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'minmax(220px, 1.5fr) minmax(150px, .8fr) minmax(145px, .8fr) minmax(145px, .8fr) auto', gap: 10, alignItems: 'end', borderBottom: '1px solid var(--color-gray-200)' }}>
                    <label><span className="filter-label">Empleado</span><select className="form-input" value={empleadoId} onChange={event => setEmpleadoId(event.target.value)}><option value="">Todos los empleados</option>{empleados.map(empleado => <option key={empleado.id} value={empleado.id}>{nombreCompleto(empleado)}</option>)}</select></label>
                    <label><span className="filter-label">Origen</span><select className="form-input" value={origen} onChange={event => setOrigen(event.target.value)}><option value="">Todos</option><option value="EMPLEADO">Ficha individual</option><option value="ROL">Tipo de empleado</option></select></label>
                    <label><span className="filter-label">Desde</span><input className="form-input" type="date" value={desde} onChange={event => setDesde(event.target.value)} /></label>
                    <label><span className="filter-label">Hasta</span><input className="form-input" type="date" value={hasta} onChange={event => setHasta(event.target.value)} /></label>
                    <button className="btn btn-ghost" onClick={limpiar} disabled={!empleadoId && !origen && !desde && !hasta}>Limpiar</button>
                </div>

                {error && <div style={{ margin: '16px 22px 0', padding: 12, borderRadius: 8, background: '#fff1f2', color: '#9f1239' }}>{error}</div>}

                <div className="table-container" style={{ margin: '18px 22px 24px' }}>
                    <table className="table">
                        <thead><tr><th>Fecha del cambio</th><th>Empleado</th><th>Origen</th><th>Valor anterior</th><th>Valor nuevo</th><th>Variación</th><th>Hora extra</th><th>Modificado por</th></tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 36 }}>Cargando historial…</td></tr> : historial.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 42 }}><strong>No hay cambios salariales registrados con estos filtros.</strong><div style={{ marginTop: 6, color: 'var(--color-gray-500)', fontSize: 13 }}>La auditoría comienza a registrar modificaciones desde la instalación de esta mejora.</div></td></tr> : historial.map(cambio => {
                                const porcentaje = variacion(cambio)
                                return <tr key={cambio.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}><strong>{fechaHora(cambio.fechaVigencia)}</strong></td>
                                    <td><strong>{nombreCompleto(cambio.empleado)}</strong>{cambio.empleado?.dni && <div style={{ color: 'var(--color-gray-500)', fontSize: 11 }}>DNI {cambio.empleado.dni}</div>}</td>
                                    <td><span className={`origin-badge ${cambio.origen.toLowerCase()}`}>{cambio.origen === 'ROL' ? cambio.rol?.nombre || 'Tipo' : 'Individual'}</span></td>
                                    <td><span style={{ color: 'var(--color-gray-600)' }}>{dinero(cambio.montoAnterior)}</span><div className="cycle">{cambio.cicloPagoAnterior.toLowerCase()}</div></td>
                                    <td><strong style={{ color: cambio.montoNuevo >= cambio.montoAnterior ? 'var(--color-success)' : 'var(--color-primary)' }}>{dinero(cambio.montoNuevo)}</strong><div className="cycle">{cambio.cicloPagoNuevo.toLowerCase()}</div></td>
                                    <td>{porcentaje === null ? '—' : <span style={{ color: 'var(--color-success)', fontWeight: 800 }}>+{porcentaje.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</span>}</td>
                                    <td>{dinero(cambio.valorHoraExtraAnterior)} → <strong>{dinero(cambio.valorHoraExtraNuevo)}</strong></td>
                                    <td>{nombreCompleto(cambio.registradoPor)}</td>
                                </tr>
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="modal-footer"><span style={{ marginRight: 'auto', color: 'var(--color-gray-500)', fontSize: 12 }}>Este historial es de sólo lectura y no modifica recibos ni liquidaciones.</span><button className="btn btn-primary" onClick={onClose}>Cerrar</button></div>
        </div>
        <style jsx>{`
            .filter-label { display: block; margin: 0 0 6px; font-size: 11px; font-weight: 800; color: var(--color-gray-600); text-transform: uppercase; letter-spacing: .04em; }
            .origin-badge { display: inline-flex; padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; background: #f1f5f9; color: #334155; }
            .origin-badge.rol { background: #fdf2f8; color: #9d174d; }
            .cycle { margin-top: 2px; color: var(--color-gray-500); font-size: 10px; text-transform: capitalize; }
            @media (max-width: 850px) { .modal-body > div:nth-child(2) { grid-template-columns: 1fr 1fr !important; } }
        `}</style>
    </div>
}
