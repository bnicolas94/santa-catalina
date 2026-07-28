"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Cuota {
    id: string
    numeroCuota: number
    monto: number
    estado: string
    mesAnio: string
    fechaVencimiento: string
    fechaPago: string | null
    liquidacionId: string | null
}

interface Prestamo {
    id: string
    fechaSolicitud: string
    montoTotal: number
    cantidadCuotas: number
    estado: string
    frecuencia: string
    modoInicio: string
    observaciones: string | null
    origenEntrega: string | null
    motivoAnulacion: string | null
    anuladoAt: string | null
    anuladoPor: { id: string; nombre: string; apellido: string | null } | null
    movimientosCaja: Array<{
        id: string
        tipo: string
        concepto: string
        monto: number
        cajaOrigen: string | null
        fecha: string
        movimientoReversaDeId: string | null
    }>
    cuotas: Cuota[]
}

interface NuevaCuotaForm {
    prestamoId: string
    monto: string
    cajaOrigen: string
    detalle: string
}

const FORM_INICIAL = {
    montoTotal: '',
    cantidadCuotas: '1',
    observaciones: '',
    frecuencia: 'SEMANAL',
    modoInicio: 'INMEDIATO',
    fechaInicio: '',
    cajaOrigen: 'caja_chica',
}

const moneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
})

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Buenos_Aires',
})

async function mensajeError(response: Response, fallback: string): Promise<string> {
    try {
        const data = await response.json()
        return typeof data.error === 'string' ? data.error : fallback
    } catch {
        return fallback
    }
}

export function PrestamosTab({ empleadoId }: { empleadoId: string }) {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const [prestamos, setPrestamos] = useState<Prestamo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [instanteReferencia] = useState(() => Date.now())
    const [showNew, setShowNew] = useState(false)
    const [form, setForm] = useState(FORM_INICIAL)
    const [editingCuota, setEditingCuota] = useState<Cuota | null>(null)
    const [editingMonto, setEditingMonto] = useState('')
    const [addingCuota, setAddingCuota] = useState<NuevaCuotaForm | null>(null)
    const [anulandoPrestamo, setAnulandoPrestamo] = useState<Prestamo | null>(null)
    const [motivoAnulacion, setMotivoAnulacion] = useState('')

    const fetchPrestamos = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const response = await fetch(`/api/empleados/${empleadoId}/prestamos`)
            if (!response.ok) throw new Error(await mensajeError(response, 'No se pudieron cargar los préstamos.'))
            const data = await response.json()
            setPrestamos(Array.isArray(data) ? data : [])
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar los préstamos.')
        } finally {
            setLoading(false)
        }
    }, [empleadoId])

    useEffect(() => {
        void fetchPrestamos()
    }, [fetchPrestamos])

    const resumenGeneral = useMemo(() => {
        const cuotas = prestamos.flatMap(prestamo => prestamo.cuotas)
        const pagado = cuotas.filter(cuota => cuota.estado === 'pagada').reduce((total, cuota) => total + cuota.monto, 0)
        const pendiente = cuotas.filter(cuota => cuota.estado === 'pendiente').reduce((total, cuota) => total + cuota.monto, 0)
        const activos = prestamos.filter(prestamo => prestamo.cuotas.some(cuota => cuota.estado === 'pendiente')).length
        return { pagado, pendiente, activos }
    }, [prestamos])

    const abrirEdicion = (cuota: Cuota) => {
        if (cuota.estado !== 'pendiente' || cuota.liquidacionId) return
        setEditingCuota(cuota)
        setEditingMonto(String(cuota.monto))
    }

    const handleUpdateCuota = async () => {
        if (!editingCuota) return
        setSaving(true)
        try {
            const response = await fetch(`/api/prestamos/cuotas/${editingCuota.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto: editingMonto }),
            })
            if (!response.ok) throw new Error(await mensajeError(response, 'No se pudo actualizar la cuota.'))
            setEditingCuota(null)
            await fetchPrestamos()
        } catch (updateError) {
            alert(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la cuota.')
        } finally {
            setSaving(false)
        }
    }

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault()
        setSaving(true)
        try {
            const response = await fetch(`/api/empleados/${empleadoId}/prestamos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!response.ok) throw new Error(await mensajeError(response, 'No se pudo crear el préstamo.'))
            setForm(FORM_INICIAL)
            setShowNew(false)
            await fetchPrestamos()
        } catch (createError) {
            alert(createError instanceof Error ? createError.message : 'No se pudo crear el préstamo.')
        } finally {
            setSaving(false)
        }
    }

    const handleAddCuota = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!addingCuota) return
        setSaving(true)
        try {
            const response = await fetch(`/api/prestamos/${addingCuota.prestamoId}/cuotas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addingCuota),
            })
            if (!response.ok) throw new Error(await mensajeError(response, 'No se pudo agregar la cuota.'))
            setAddingCuota(null)
            await fetchPrestamos()
        } catch (addError) {
            alert(addError instanceof Error ? addError.message : 'No se pudo agregar la cuota.')
        } finally {
            setSaving(false)
        }
    }

    const handleAnularPrestamo = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!anulandoPrestamo) return
        setSaving(true)
        try {
            const response = await fetch(`/api/prestamos/${anulandoPrestamo.id}/anular`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo: motivoAnulacion }),
            })
            if (!response.ok) throw new Error(await mensajeError(response, 'No se pudo anular el préstamo.'))
            setAnulandoPrestamo(null)
            setMotivoAnulacion('')
            await fetchPrestamos()
        } catch (annulError) {
            alert(annulError instanceof Error ? annulError.message : 'No se pudo anular el préstamo.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-10 text-center text-gray-400">Cargando préstamos...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {anulandoPrestamo && (
                <div role="dialog" aria-modal="true" aria-label="Anular préstamo" style={overlayStyle}>
                    <div className="card shadow-lg" style={{ width: 'min(480px, calc(100vw - 32px))', padding: 'var(--space-6)', background: 'white' }}>
                        <div style={eyebrowStyle}>ANULACIÓN CONTABLE</div>
                        <h4 style={{ margin: '4px 0 var(--space-3)', fontSize: 'var(--text-lg)' }}>Anular préstamo de {moneda.format(anulandoPrestamo.montoTotal)}</h4>
                        <p style={{ color: 'var(--color-gray-600)', fontSize: 'var(--text-sm)', lineHeight: 1.55, margin: '0 0 var(--space-4)' }}>
                            Se anularán sus cuotas pendientes y se crearán movimientos compensatorios en las cajas originales. El préstamo y los movimientos previos permanecerán visibles para auditoría.
                        </p>
                        <form onSubmit={handleAnularPrestamo}>
                            <div className="form-group">
                                <label className="form-label">Motivo obligatorio</label>
                                <textarea
                                    autoFocus
                                    required
                                    minLength={10}
                                    maxLength={500}
                                    className="form-input"
                                    rows={4}
                                    placeholder="Ej. Préstamo cargado por duplicado"
                                    value={motivoAnulacion}
                                    onChange={event => setMotivoAnulacion(event.target.value)}
                                />
                                <div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', marginTop: 4 }}>{motivoAnulacion.trim().length}/500 · mínimo 10 caracteres</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                                <button type="button" className="btn btn-outline" disabled={saving} onClick={() => { setAnulandoPrestamo(null); setMotivoAnulacion('') }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving || motivoAnulacion.trim().length < 10} style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                                    {saving ? 'Anulando...' : 'Confirmar anulación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {editingCuota && (
                <div role="dialog" aria-modal="true" aria-label="Editar cuota pendiente" style={overlayStyle}>
                    <div className="card shadow-lg" style={{ width: 'min(420px, calc(100vw - 32px))', padding: 'var(--space-6)', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                            <div>
                                <div style={eyebrowStyle}>CUOTA PENDIENTE</div>
                                <h4 style={{ margin: '4px 0 0', fontSize: 'var(--text-lg)' }}>Editar cuota {editingCuota.numeroCuota}</h4>
                            </div>
                            <button className="btn btn-outline" onClick={() => setEditingCuota(null)} aria-label="Cerrar">×</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Monto de la cuota</label>
                            <input
                                autoFocus
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="form-input"
                                value={editingMonto}
                                onChange={event => setEditingMonto(event.target.value)}
                            />
                        </div>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)', lineHeight: 1.5, margin: 'var(--space-3) 0 var(--space-5)' }}>
                            Sólo se puede corregir mientras esté pendiente. Una vez descontada quedará vinculada al recibo y será de solo lectura.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                            <button className="btn btn-outline" onClick={() => setEditingCuota(null)} disabled={saving}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleUpdateCuota} disabled={saving}>
                                {saving ? 'Guardando...' : 'Guardar corrección'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {addingCuota && (
                <div role="dialog" aria-modal="true" aria-label="Agregar cuota" style={overlayStyle}>
                    <div className="card shadow-lg" style={{ width: 'min(480px, calc(100vw - 32px))', padding: 'var(--space-6)', background: 'white' }}>
                        <div style={eyebrowStyle}>AMPLIACIÓN DEL PRÉSTAMO</div>
                        <h4 style={{ margin: '4px 0 var(--space-5)', fontSize: 'var(--text-lg)' }}>Agregar una nueva cuota</h4>
                        <form onSubmit={handleAddCuota}>
                            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                <label className="form-label">Monto</label>
                                <input required type="number" min="0.01" step="0.01" className="form-input" value={addingCuota.monto} onChange={event => setAddingCuota({ ...addingCuota, monto: event.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                <label className="form-label">Origen / concepto</label>
                                <select className="form-select" value={addingCuota.cajaOrigen} onChange={event => setAddingCuota({ ...addingCuota, cajaOrigen: event.target.value })}>
                                    <option value="mercaderia">Retiro de mercadería</option>
                                    <option value="caja_chica">Caja Chica (Fábrica)</option>
                                    <option value="caja_chica_local">Caja Chica Local</option>
                                    <option value="mercado_pago">Mercado Pago</option>
                                    <option value="mercado_pago_juani">Mercado Pago Juani</option>
                                    <option value="ninguna">Sin movimiento de caja / refinanciación</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                                <label className="form-label">Detalle opcional</label>
                                <input type="text" maxLength={200} className="form-input" placeholder="Motivo o concepto de la ampliación" value={addingCuota.detalle} onChange={event => setAddingCuota({ ...addingCuota, detalle: event.target.value })} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setAddingCuota(null)} disabled={saving}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Agregando...' : 'Agregar cuota'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                    <div style={eyebrowStyle}>CUENTA DEL EMPLEADO</div>
                    <h3 style={{ margin: '4px 0 0', fontSize: 'var(--text-xl)' }}>Préstamos y adelantos</h3>
                    <p style={{ margin: '6px 0 0', color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Seguimiento de cuotas, descuentos y saldo pendiente.</p>
                </div>
                <button onClick={() => setShowNew(value => !value)} className={showNew ? 'btn btn-outline' : 'btn btn-primary'}>
                    {showNew ? 'Cerrar formulario' : '+ Otorgar préstamo'}
                </button>
            </div>

            {error && (
                <div style={{ padding: 'var(--space-4)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-lg)' }}>
                    {error} <button className="btn btn-outline" onClick={() => void fetchPrestamos()} style={{ marginLeft: 'var(--space-3)' }}>Reintentar</button>
                </div>
            )}

            {prestamos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
                    <SummaryCard label="Saldo pendiente" value={moneda.format(resumenGeneral.pendiente)} tone="warning" />
                    <SummaryCard label="Total descontado" value={moneda.format(resumenGeneral.pagado)} tone="success" />
                    <SummaryCard label="Préstamos activos" value={String(resumenGeneral.activos)} tone="neutral" />
                </div>
            )}

            {showNew && (
                <div className="card" style={{ padding: 'var(--space-5)', border: '1px solid var(--color-primary)', background: 'var(--color-info-bg)' }}>
                    <div style={eyebrowStyle}>NUEVO REGISTRO</div>
                    <h4 style={{ margin: '4px 0 var(--space-5)' }}>Otorgar préstamo o adelanto</h4>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                        <Field label="Monto total">
                            <input required type="number" min="0.01" step="0.01" value={form.montoTotal} onChange={event => setForm({ ...form, montoTotal: event.target.value })} className="form-input" />
                        </Field>
                        <Field label="Cantidad de cuotas">
                            <input required type="number" min="1" max="60" step="1" value={form.cantidadCuotas} onChange={event => setForm({ ...form, cantidadCuotas: event.target.value })} className="form-input" />
                        </Field>
                        <Field label="Frecuencia">
                            <select value={form.frecuencia} onChange={event => setForm({ ...form, frecuencia: event.target.value })} className="form-select">
                                <option value="SEMANAL">Semanal</option>
                                <option value="MENSUAL">Mensual</option>
                            </select>
                        </Field>
                        <Field label="Primera cuota">
                            <select value={form.modoInicio} onChange={event => setForm({ ...form, modoInicio: event.target.value })} className="form-select">
                                <option value="INMEDIATO">En el período actual</option>
                                <option value="FECHA_ESPECIFICA">En una fecha específica</option>
                                <option value="AL_FINALIZAR_ANTERIOR">Después del préstamo anterior</option>
                            </select>
                        </Field>
                        {form.modoInicio === 'FECHA_ESPECIFICA' && (
                            <Field label="Fecha de la primera cuota">
                                <input required type="date" value={form.fechaInicio} onChange={event => setForm({ ...form, fechaInicio: event.target.value })} className="form-input" />
                            </Field>
                        )}
                        <Field label="Caja de origen">
                            <select value={form.cajaOrigen} onChange={event => setForm({ ...form, cajaOrigen: event.target.value })} className="form-select">
                                <option value="caja_chica">Caja Chica (Fábrica)</option>
                                <option value="caja_chica_local">Caja Chica Local</option>
                                <option value="mercado_pago">Mercado Pago</option>
                                <option value="mercado_pago_juani">Mercado Pago Juani</option>
                                <option value="mercaderia">Retiro de mercadería</option>
                            </select>
                        </Field>
                        <Field label="Observaciones">
                            <input type="text" maxLength={500} value={form.observaciones} onChange={event => setForm({ ...form, observaciones: event.target.value })} placeholder="Motivo o referencia" className="form-input" />
                        </Field>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Confirmar y generar cuotas'}</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {prestamos.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                        <p style={{ color: 'var(--color-gray-500)' }}>No hay préstamos registrados para este empleado.</p>
                    </div>
                ) : prestamos.map(prestamo => (
                    <PrestamoCard key={prestamo.id} prestamo={prestamo} instanteReferencia={instanteReferencia} esAdmin={esAdmin} onEdit={abrirEdicion} onAdd={setAddingCuota} onAnular={setAnulandoPrestamo} />
                ))}
            </div>
        </div>
    )
}

function PrestamoCard({ prestamo, instanteReferencia, esAdmin, onEdit, onAdd, onAnular }: {
    prestamo: Prestamo
    instanteReferencia: number
    esAdmin: boolean
    onEdit: (cuota: Cuota) => void
    onAdd: (form: NuevaCuotaForm) => void
    onAnular: (prestamo: Prestamo) => void
}) {
    const pagadas = prestamo.cuotas.filter(cuota => cuota.estado === 'pagada')
    const pendientes = prestamo.cuotas.filter(cuota => cuota.estado === 'pendiente')
    const montoPagado = pagadas.reduce((total, cuota) => total + cuota.monto, 0)
    const saldo = pendientes.reduce((total, cuota) => total + cuota.monto, 0)
    const progreso = prestamo.cuotas.length > 0 ? Math.round((pagadas.length / prestamo.cuotas.length) * 100) : 0
    const proxima = [...pendientes].sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())[0]
    const anulado = prestamo.estado === 'anulado'
    const activo = !anulado && pendientes.length > 0
    const anulable = activo
        && Boolean(prestamo.origenEntrega)
        && !prestamo.cuotas.some(cuota => cuota.estado === 'pagada' || cuota.liquidacionId)

    return (
        <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--color-gray-200)' }}>
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-gray-50)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 'var(--text-lg)' }}>{moneda.format(prestamo.montoTotal)}</strong>
                            <span className={`badge ${anulado ? 'badge-danger' : activo ? 'badge-warning' : 'badge-success'}`}>{anulado ? 'Anulado' : activo ? 'Activo' : 'Saldado'}</span>
                            {prestamo.modoInicio === 'AL_FINALIZAR_ANTERIOR' && <span className="badge">Secuencial</span>}
                            {!prestamo.origenEntrega && !anulado && <span className="badge">Registro histórico</span>}
                        </div>
                        <div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)', marginTop: '6px' }}>
                            Otorgado el {formatoFecha.format(new Date(prestamo.fechaSolicitud))} · {prestamo.cuotas.length} cuotas {prestamo.frecuencia === 'SEMANAL' ? 'semanales' : 'mensuales'}
                        </div>
                        {prestamo.observaciones && <div style={{ color: 'var(--color-gray-600)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>{prestamo.observaciones}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {activo && <button className="btn btn-outline" onClick={() => onAdd({ prestamoId: prestamo.id, monto: String(proxima?.monto || ''), cajaOrigen: 'mercaderia', detalle: '' })}>+ Agregar cuota</button>}
                        {esAdmin && anulable && <button className="btn btn-outline" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => onAnular(prestamo)}>Anular préstamo</button>}
                    </div>
                </div>
                {anulado && (
                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                        <strong>Anulado{prestamo.anuladoAt ? ` el ${formatoFecha.format(new Date(prestamo.anuladoAt))}` : ''}</strong>
                        {prestamo.anuladoPor && ` por ${prestamo.anuladoPor.nombre} ${prestamo.anuladoPor.apellido || ''}`}
                        {prestamo.motivoAnulacion && <div style={{ marginTop: 4 }}>{prestamo.motivoAnulacion}</div>}
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                    <Metric label="Saldo pendiente" value={moneda.format(saldo)} />
                    <Metric label="Ya descontado" value={moneda.format(montoPagado)} />
                    <Metric label="Próxima cuota" value={proxima ? `${moneda.format(proxima.monto)} · ${formatoFecha.format(new Date(proxima.fechaVencimiento))}` : 'Sin cuotas pendientes'} />
                </div>
                <div style={{ marginTop: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', marginBottom: '6px' }}>
                        <span>{pagadas.length} de {prestamo.cuotas.length} cuotas descontadas</span><strong>{progreso}%</strong>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--color-gray-200)', overflow: 'hidden' }}>
                        <div style={{ width: `${progreso}%`, height: '100%', background: 'var(--color-success)', transition: 'width .2s ease' }} />
                    </div>
                </div>
            </div>
            <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
                {prestamo.cuotas.map(cuota => <CuotaCard key={cuota.id} cuota={cuota} total={prestamo.cuotas.length} instanteReferencia={instanteReferencia} onEdit={onEdit} />)}
            </div>
        </div>
    )
}

function CuotaCard({ cuota, total, instanteReferencia, onEdit }: { cuota: Cuota; total: number; instanteReferencia: number; onEdit: (cuota: Cuota) => void }) {
    const pagada = cuota.estado === 'pagada'
    const anulada = cuota.estado === 'anulada'
    const editable = cuota.estado === 'pendiente' && !cuota.liquidacionId
    const vencida = editable && new Date(cuota.fechaVencimiento).getTime() < instanteReferencia
    return (
        <button
            type="button"
            onClick={() => editable && onEdit(cuota)}
            disabled={!editable}
            title={pagada ? 'Cuota descontada y vinculada a una liquidación' : anulada ? 'Cuota anulada' : 'Editar monto pendiente'}
            style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${pagada ? 'var(--color-success)' : anulada ? 'var(--color-danger)' : vencida ? 'var(--color-warning)' : 'var(--color-gray-200)'}`,
                background: pagada ? 'var(--color-success-bg)' : anulada ? 'var(--color-danger-bg)' : 'var(--color-white)',
                textAlign: 'left',
                cursor: editable ? 'pointer' : 'default',
                opacity: pagada || anulada ? .82 : 1,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)' }}>
                <span>Cuota {cuota.numeroCuota}/{total}</span><span>{editable ? 'Editar' : '🔒'}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginTop: 6, color: 'var(--color-gray-900)' }}>{moneda.format(cuota.monto)}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: 4 }}>
                Vence {formatoFecha.format(new Date(cuota.fechaVencimiento))}
            </div>
            <div style={{ marginTop: 8, fontSize: '10px', fontWeight: 700, color: pagada ? 'var(--color-success)' : anulada ? 'var(--color-danger)' : vencida ? 'var(--color-warning)' : 'var(--color-gray-600)' }}>
                {pagada ? `DESCONTADA${cuota.fechaPago ? ` · ${formatoFecha.format(new Date(cuota.fechaPago))}` : ''}` : anulada ? 'ANULADA' : vencida ? 'VENCIDA · PRÓXIMO DESCUENTO' : 'PROGRAMADA'}
            </div>
        </button>
    )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'warning' | 'success' | 'neutral' }) {
    const color = tone === 'warning' ? 'var(--color-warning)' : tone === 'success' ? 'var(--color-success)' : 'var(--color-gray-900)'
    return <div className="card" style={{ padding: 'var(--space-4)' }}><div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{label}</div><div style={{ color, fontSize: 'var(--text-xl)', fontWeight: 750, marginTop: 4 }}>{value}</div></div>
}

function Metric({ label, value }: { label: string; value: string }) {
    return <div><div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)' }}>{label}</div><div style={{ color: 'var(--color-gray-900)', fontSize: 'var(--text-sm)', fontWeight: 650, marginTop: 3 }}>{value}</div></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="form-group"><label className="form-label">{label}</label>{children}</div>
}

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.56)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1000,
}

const eyebrowStyle: React.CSSProperties = {
    color: 'var(--color-primary)',
    fontSize: 'var(--text-xs)',
    fontWeight: 750,
    letterSpacing: '.08em',
}
