'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

import { imprimirRecibosLiquidacion, type DatosReciboLiquidacion } from '@/components/empleados/recibosLiquidacion'

interface CandidatoFeriado {
    empleadoId: string
    empleadoNombre: string
    empleadoDni: string | null
    empleadoActivo: boolean
    horas: number
    monto: number
    liquidacionOriginalId: string
    estado: 'DISPONIBLE' | 'YA_INCLUIDO' | 'YA_PAGADO'
    motivo: string | null
}

interface HistorialFeriado {
    liquidacionId: string
    empleadoId: string
    empleadoNombre: string
    empleadoDni: string | null
    empleadoActivo: boolean
    fechaFeriado: string
    nombreFeriado: string
    semanaOrigen: string
    cantidadHoras: number
    monto: number
    fechaPago: string
    estado: 'pagado' | 'anulado'
    movimientoCaja?: { id: string; cajaOrigen: string | null } | null
}

interface PagoCreado {
    id: string
    periodo: string
    fechaGeneracion: string
    empleadoNombre: string
    empleadoDni: string | null
    horasFeriado: number
    montoHorasFeriado: number
    totalNeto: number
    desglose: Record<string, unknown>
}

interface Caja {
    id: string
    nombre: string
    saldo: number
}

interface Props {
    onClose: () => void
}

const dinero = (monto: number) => `$${Math.round(monto).toLocaleString('es-AR')}`

function fechaAnterior() {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 7)
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

function reciboHistorial(pago: HistorialFeriado): DatosReciboLiquidacion {
    return {
        empleado: {
            nombre: pago.empleadoNombre,
            apellido: null,
            dni: pago.empleadoDni,
        },
        periodo: `Pago de feriado adeudado · ${pago.nombreFeriado}`,
        fechaGeneracion: pago.fechaPago,
        tipo: 'FERIADO_ADEUDADO',
        montoHorasFeriado: pago.monto,
        totalNeto: pago.monto,
        desglose: {
            origen: 'FERIADO_ADEUDADO',
            fechaFeriado: pago.fechaFeriado,
            nombreFeriado: pago.nombreFeriado,
            semanaOrigen: pago.semanaOrigen,
            cantidadHoras: pago.cantidadHoras,
            monto: pago.monto,
        },
    }
}

function reciboCreado(pago: PagoCreado): DatosReciboLiquidacion {
    const partes = pago.empleadoNombre.trim().split(/\s+/)
    return {
        empleado: {
            nombre: partes.shift() || pago.empleadoNombre,
            apellido: partes.join(' '),
            dni: pago.empleadoDni,
        },
        periodo: pago.periodo,
        fechaGeneracion: pago.fechaGeneracion,
        tipo: 'FERIADO_ADEUDADO',
        montoHorasFeriado: pago.montoHorasFeriado,
        totalNeto: pago.totalNeto,
        desglose: pago.desglose,
    }
}

export function FeriadosAdeudadosModal({ onClose }: Props) {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const [fecha, setFecha] = useState(fechaAnterior)
    const [feriado, setFeriado] = useState<{ id: string; nombre: string; fecha: string } | null>(null)
    const [candidatos, setCandidatos] = useState<CandidatoFeriado[]>([])
    const [historial, setHistorial] = useState<HistorialFeriado[]>([])
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
    const [cajas, setCajas] = useState<Caja[]>([])
    const [cajaId, setCajaId] = useState('caja_madre')
    const [cargando, setCargando] = useState(false)
    const [pagando, setPagando] = useState(false)
    const [anulandoId, setAnulandoId] = useState<string | null>(null)
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

    const cargar = useCallback(async (fechaConsulta = fecha) => {
        setCargando(true)
        setMensaje(null)
        try {
            const [respuestaFeriados, respuestaCajas] = await Promise.all([
                fetch(`/api/empleados/feriados-adeudados?fecha=${encodeURIComponent(fechaConsulta)}`),
                fetch('/api/caja/saldos'),
            ])
            const data = await respuestaFeriados.json()
            const saldos = await respuestaCajas.json()
            if (!respuestaFeriados.ok) throw new Error(data.error || 'No se pudo analizar el feriado.')
            if (!respuestaCajas.ok) throw new Error(saldos.error || 'No se pudieron cargar las cajas.')

            setFeriado(data.feriado || null)
            setCandidatos(data.candidatos || [])
            setHistorial(data.historial || [])
            setSeleccionados(new Set())
            setCajas([
                { id: 'caja_madre', nombre: 'Caja Madre', saldo: saldos.cajaMadre?.saldo || 0 },
                { id: 'caja_chica', nombre: 'Caja Chica', saldo: saldos.cajaChica?.saldo || 0 },
                { id: 'local', nombre: 'Caja Local', saldo: saldos.local?.saldo || 0 },
                { id: 'caja_chica_local', nombre: 'Caja Chica Local', saldo: saldos.cajaChicaLocal?.saldo || 0 },
                { id: 'mercado_pago', nombre: 'Mercado Pago', saldo: saldos.mercadoPago?.saldo || 0 },
                { id: 'mercado_pago_juani', nombre: 'Mercado Pago Juani', saldo: saldos.mercadoPagoJuani?.saldo || 0 },
            ])

            if (!data.feriado) {
                setMensaje({ tipo: 'error', texto: 'La fecha elegida no está registrada como feriado. Primero cargala desde Configuración → Feriados.' })
            }
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo cargar el módulo.' })
        } finally {
            setCargando(false)
        }
    }, [fecha])

    useEffect(() => { void cargar() }, [cargar])

    const disponibles = candidatos.filter(candidato => candidato.estado === 'DISPONIBLE')
    const totalSeleccionado = disponibles
        .filter(candidato => seleccionados.has(candidato.empleadoId))
        .reduce((total, candidato) => total + candidato.monto, 0)

    const todosSeleccionados = disponibles.length > 0
        && disponibles.every(candidato => seleccionados.has(candidato.empleadoId))

    const toggleEmpleado = (empleadoId: string) => {
        const siguiente = new Set(seleccionados)
        if (siguiente.has(empleadoId)) siguiente.delete(empleadoId)
        else siguiente.add(empleadoId)
        setSeleccionados(siguiente)
    }

    const toggleTodos = () => {
        setSeleccionados(todosSeleccionados
            ? new Set()
            : new Set(disponibles.map(candidato => candidato.empleadoId)))
    }

    const pagar = async (imprimir: boolean) => {
        if (seleccionados.size === 0 || !feriado) return
        if (!confirm(`¿Registrar ${seleccionados.size} pago${seleccionados.size === 1 ? '' : 's'} por ${dinero(totalSeleccionado)} desde la caja seleccionada?`)) return

        const ventana = imprimir ? window.open('', '_blank') : null
        if (imprimir && !ventana) {
            setMensaje({ tipo: 'error', texto: 'El navegador bloqueó la ventana del recibo. Habilitá las ventanas emergentes e intentá nuevamente.' })
            return
        }
        if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:24px">Registrando pagos y preparando recibos…</p>')

        setPagando(true)
        setMensaje(null)
        try {
            const respuesta = await fetch('/api/empleados/feriados-adeudados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha, cajaId, empleadoIds: [...seleccionados] }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudieron registrar los pagos.')

            if (imprimir && ventana) {
                await imprimirRecibosLiquidacion(
                    (data.liquidaciones as PagoCreado[]).map(reciboCreado),
                    'A',
                    ventana,
                )
            }
            await cargar(fecha)
            setMensaje({
                tipo: 'ok',
                texto: `${data.liquidaciones.length} pago${data.liquidaciones.length === 1 ? '' : 's'} registrado${data.liquidaciones.length === 1 ? '' : 's'} en su fecha original, sin modificar la semana actual.`,
            })
        } catch (error) {
            ventana?.close()
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudieron registrar los pagos.' })
        } finally {
            setPagando(false)
        }
    }

    const anular = async (pago: HistorialFeriado) => {
        const motivo = window.prompt('Indicá el motivo de la anulación (entre 10 y 500 caracteres):', '')
        if (motivo === null) return
        if (motivo.trim().length < 10 || motivo.trim().length > 500) {
            setMensaje({ tipo: 'error', texto: 'El motivo debe tener entre 10 y 500 caracteres.' })
            return
        }
        if (!confirm(`¿Anular el pago de ${dinero(pago.monto)} a ${pago.empleadoNombre}? El importe será reintegrado a la caja.`)) return

        setAnulandoId(pago.liquidacionId)
        try {
            const respuesta = await fetch('/api/empleados/feriados-adeudados/anular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ liquidacionId: pago.liquidacionId, motivo: motivo.trim() }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo anular el pago.')
            await cargar(fecha)
            setMensaje({ tipo: 'ok', texto: 'Pago anulado y reintegrado a la caja. El empleado volvió a quedar disponible para ese feriado.' })
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo anular el pago.' })
        } finally {
            setAnulandoId(null)
        }
    }

    const historialVisible = useMemo(() => historial.slice(0, 100), [historial])

    return <div className="modal-overlay" onMouseDown={onClose}>
        <div className="modal" onMouseDown={evento => evento.stopPropagation()} style={{ maxWidth: 1050, width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
                <div>
                    <div style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Pago complementario</div>
                    <h2 style={{ margin: '4px 0' }}>Feriados adeudados</h2>
                    <p style={{ margin: 0, color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Pagá sólo el adicional omitido y mantenelo atribuido a la semana original.</p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto' }}>
                {mensaje && <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: mensaje.tipo === 'ok' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: mensaje.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>{mensaje.texto}</div>}

                <section className="card" style={{ border: '1px solid var(--color-gray-200)' }}>
                    <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, .8fr) minmax(260px, 1.2fr) auto', gap: 16, alignItems: 'end' }}>
                        <label className="form-group" style={{ margin: 0 }}><span className="form-label">Fecha del feriado omitido</span><input className="form-input" type="date" value={fecha} onChange={evento => setFecha(evento.target.value)} /></label>
                        <div><div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase' }}>Feriado detectado</div><strong>{feriado?.nombre || 'Sin feriado registrado'}</strong></div>
                        <button className="btn btn-outline" disabled={cargando || !fecha} onClick={() => void cargar(fecha)}>{cargando ? 'Analizando…' : 'Buscar liquidaciones'}</button>
                    </div>
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 16, marginTop: 16 }}>
                    <section className="card" style={{ border: '1px solid var(--color-gray-200)' }}>
                        <div className="card-body" style={{ padding: 0 }}>
                            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-gray-200)', display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><h3 style={{ margin: 0 }}>Empleados de la liquidación original</h3><span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)' }}>El importe usa el jornal histórico ya liquidado.</span></div>{disponibles.length > 0 && <button className="btn btn-ghost btn-sm" onClick={toggleTodos}>{todosSeleccionados ? 'Quitar todos' : 'Seleccionar todos'}</button>}</div>
                            <div className="table-container" style={{ maxHeight: 360, border: 0 }}><table className="table"><thead><tr><th style={{ width: 40 }}></th><th>Empleado</th><th>Estado</th><th style={{ textAlign: 'right' }}>Adicional</th></tr></thead><tbody>
                                {cargando ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28 }}>Analizando liquidaciones…</td></tr> : candidatos.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-gray-500)' }}>No se encontraron empleados con horas trabajadas y una liquidación semanal pagada para este día.</td></tr> : candidatos.map(candidato => {
                                    const disponible = candidato.estado === 'DISPONIBLE'
                                    return <tr key={candidato.empleadoId} style={{ opacity: disponible ? 1 : .58 }}>
                                        <td><input type="checkbox" disabled={!disponible} checked={seleccionados.has(candidato.empleadoId)} onChange={() => toggleEmpleado(candidato.empleadoId)} /></td>
                                        <td><strong>{candidato.empleadoNombre}</strong><div style={{ color: 'var(--color-gray-500)', fontSize: '10px' }}>{candidato.horas.toLocaleString('es-AR')} h de jornada</div></td>
                                        <td>{disponible ? <span className="badge badge-warning">Pendiente</span> : <span title={candidato.motivo || ''}>{candidato.estado === 'YA_PAGADO' ? 'Ya pagado' : 'Incluido en la semana'}</span>}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{disponible ? dinero(candidato.monto) : '—'}</td>
                                    </tr>
                                })}
                            </tbody></table></div>
                        </div>
                    </section>

                    <aside className="card" style={{ border: '1px solid var(--color-gray-200)', alignSelf: 'start' }}><div className="card-body">
                        <h3 style={{ marginTop: 0 }}>Caja y confirmación</h3>
                        <select className="form-select" value={cajaId} onChange={evento => setCajaId(evento.target.value)}>{cajas.map(caja => <option key={caja.id} value={caja.id}>{caja.nombre} · {dinero(caja.saldo)}</option>)}</select>
                        <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: 'var(--color-primary)', color: 'white' }}><div style={{ opacity: .8, fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase' }}>Total seleccionado</div><div style={{ fontSize: '1.7rem', fontWeight: 800 }}>{dinero(totalSeleccionado)}</div><div style={{ opacity: .8, fontSize: 'var(--text-xs)' }}>{seleccionados.size} empleado{seleccionados.size === 1 ? '' : 's'}</div></div>
                        <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={pagando || seleccionados.size === 0 || !feriado} onClick={() => void pagar(false)}>{pagando ? 'Registrando…' : 'Pagar seleccionados'}</button>
                        <button className="btn btn-outline" style={{ width: '100%', marginTop: 8 }} disabled={pagando || seleccionados.size === 0 || !feriado} onClick={() => void pagar(true)}>Pagar e imprimir</button>
                        <p style={{ marginBottom: 0, color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', lineHeight: 1.45 }}>Cada empleado genera un comprobante y un egreso de Caja independientes. La liquidación semanal original no se modifica.</p>
                    </div></aside>
                </div>

                <section style={{ marginTop: 22 }}><div style={{ marginBottom: 10 }}><h3 style={{ margin: 0 }}>Historial de complementos</h3><span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Reimprimí o anulá pagos sin perder trazabilidad.</span></div>
                    <div className="table-container" style={{ maxHeight: 310 }}><table className="table"><thead><tr><th>Estado</th><th>Empleado</th><th>Feriado</th><th>Semana original</th><th style={{ textAlign: 'right' }}>Importe</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead><tbody>
                        {historialVisible.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--color-gray-500)' }}>Todavía no hay pagos complementarios.</td></tr> : historialVisible.map(pago => <tr key={pago.liquidacionId} style={{ opacity: pago.estado === 'anulado' ? .58 : 1 }}>
                            <td><span className={`badge ${pago.estado === 'pagado' ? 'badge-success' : 'badge-danger'}`}>{pago.estado === 'pagado' ? 'Pagado' : 'Anulado'}</span></td>
                            <td><strong>{pago.empleadoNombre}</strong><div style={{ color: 'var(--color-gray-500)', fontSize: '10px' }}>{pago.empleadoDni || 'DNI sin informar'}</div></td>
                            <td>{pago.nombreFeriado}<div style={{ color: 'var(--color-gray-500)', fontSize: '10px' }}>{pago.fechaFeriado.split('-').reverse().join('/')}</div></td>
                            <td style={{ fontSize: 'var(--text-xs)' }}>{pago.semanaOrigen}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{dinero(pago.monto)}</td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{pago.estado === 'pagado' && <><button className="btn btn-ghost btn-sm" onClick={() => void imprimirRecibosLiquidacion([reciboHistorial(pago)], 'A')}>Imprimir</button>{esAdmin && <button className="btn btn-ghost btn-sm" disabled={anulandoId === pago.liquidacionId} onClick={() => void anular(pago)}>{anulandoId === pago.liquidacionId ? 'Anulando…' : 'Anular'}</button>}</>}</td>
                        </tr>)}
                    </tbody></table></div>
                </section>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Cerrar</button></div>
        </div>
    </div>
}
