"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ExpressLiquidationModal } from '@/components/empleados/ExpressLiquidationModal'
import { CambiarCajaPagoButton } from '@/components/empleados/CambiarCajaPagoButton'
import { imprimirRecibosLiquidacion, MODELOS_RECIBO, type ModeloRecibo } from '@/components/empleados/recibosLiquidacion'

export function LiquidacionesTab({ empleadoId, empleadoDatos }: { empleadoId: string, empleadoDatos: any }) {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const [liquidaciones, setLiquidaciones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [generando, setGenerando] = useState(false)
    const [mes, setMes] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM
    const [fechaDesde, setFechaDesde] = useState(() => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        d.setDate(diff)
        return d.toISOString().split('T')[0]
    })
    const [fechaHasta, setFechaHasta] = useState(() => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? 0 : 7)
        d.setDate(diff)
        return d.toISOString().split('T')[0]
    })
    const [tipoPeriodo, setTipoPeriodo] = useState(empleadoDatos.cicloPago === 'SEMANAL' ? 'semana' : 'mes')

    const [cajas, setCajas] = useState<any[]>([])
    const [cajaSeleccionada, setCajaSeleccionada] = useState('caja_madre')
    const [conceptos, setConceptos] = useState<any[]>([])
    const [conceptoSeleccionado, setConceptoSeleccionado] = useState('pago_sueldo')

    const [alertas, setAlertas] = useState<string[]>([])
    const [escaneando, setEscaneando] = useState(false)
    const [expressModalOpen, setExpressModalOpen] = useState(false)
    const [liquidacionAAnular, setLiquidacionAAnular] = useState<any | null>(null)
    const [motivoAnulacion, setMotivoAnulacion] = useState('')
    const [anulando, setAnulando] = useState(false)
    const [errorAnulacion, setErrorAnulacion] = useState('')
    const [modeloRecibo, setModeloRecibo] = useState<ModeloRecibo>('A')

    const fetchLiquidaciones = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/liquidaciones?empleadoId=${empleadoId}&incluirAnuladas=true&t=${Date.now()}`)
            const data = await res.json()
            setLiquidaciones(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const scanFichadas = async () => {
        setEscaneando(true)
        setAlertas([])
        try {
            let start, end
            if (tipoPeriodo === 'mes') {
                start = `${mes}-01T00:00:00.000Z`
                let d = new Date(start)
                d.setMonth(d.getMonth() + 1)
                end = d.toISOString()
            } else {
                start = new Date(`${fechaDesde}T00:00:00.000Z`).toISOString()
                end = new Date(`${fechaHasta}T23:59:59.999Z`).toISOString()
            }

            // Llamamos a las fichadas del empleado en ese rango
            const res = await fetch(`/api/fichadas?empleadoId=${empleadoId}&inicio=${start}&fin=${end}`)
            const fichadas = await res.json()

            if (fichadas.length === 0) {
                setAlertas(['No hay fichadas registradas en este periodo.'])
                return
            }

            // Agrupar por día (usando la lógica de horas.ts simplificada aquí o trayendo la utilidad)
            const marcasPorDia: Record<string, any[]> = {}
            fichadas.forEach((f: any) => {
                const d = new Date(f.fechaHora)
                const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                if (!marcasPorDia[fecha]) marcasPorDia[fecha] = []
                marcasPorDia[fecha].push(f)
            })

            const nuevasAlertas: string[] = []
            Object.entries(marcasPorDia).forEach(([fecha, marcas]) => {
                if (marcas.length % 2 !== 0) {
                    nuevasAlertas.push(`Día ${fecha.split('-').reverse().join('/')}: Tiene marcas impares (información incompleta).`)
                }
            })

            setAlertas(nuevasAlertas)
        } catch (e) {
            console.error(e)
        } finally {
            setEscaneando(false)
        }
    }

    const fetchCajas = async () => {
        try {
            const res = await fetch('/api/caja/saldos')
            const data = await res.json()
            const lista = [
                { id: 'caja_madre', nombre: 'Caja Madre', saldo: data.cajaMadre?.saldo || 0 },
                { id: 'caja_chica', nombre: 'Caja Chica', saldo: data.cajaChica?.saldo || 0 },
                { id: 'local', nombre: 'Caja Local', saldo: data.local?.saldo || 0 }
            ]
            setCajas(lista)
        } catch (error) {
            console.error(error)
        }
    }

    const fetchConceptos = async () => {
        try {
            const res = await fetch('/api/caja/conceptos')
            const data = await res.json()
            setConceptos(data)
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => {
        fetchLiquidaciones()
        fetchCajas()
        fetchConceptos()
    }, [empleadoId])

    useEffect(() => {
        scanFichadas()
    }, [mes, fechaDesde, fechaHasta, tipoPeriodo, empleadoId])

    const handleGenerar = async () => {
        if (!confirm(`¿Generar liquidación de ${empleadoDatos.cicloPago} para el periodo ${mes}? Se descontará de ${cajas.find(c => c.id === cajaSeleccionada)?.nombre}.`)) return

        setGenerando(true)
        try {
            let start, end, perName

            if (tipoPeriodo === 'mes') {
                start = `${mes}-01`
                const [anio, numeroMes] = mes.split('-').map(Number)
                end = new Date(Date.UTC(anio, numeroMes, 0)).toISOString().slice(0, 10)
                perName = `${empleadoDatos.cicloPago} - ${mes}`
            } else {
                start = fechaDesde
                end = fechaHasta
                perName = `${empleadoDatos.cicloPago} del ${fechaDesde.split('-').reverse().join('/')} al ${fechaHasta.split('-').reverse().join('/')}`
            }

            const res = await fetch('/api/liquidaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    periodo: perName,
                    fechaInicio: start,
                    fechaFin: end,
                    cajaId: cajaSeleccionada,
                    concepto: conceptoSeleccionado
                })
            })

            if (res.ok) {
                alert('Liquidación generada con éxito y descontada de caja')
                fetchLiquidaciones()
                fetchCajas()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al generar')
            }
        } catch (error) {
            console.error(error)
            alert('Error en la petición')
        } finally {
            setGenerando(false)
        }
    }

    const confirmarAnulacion = async () => {
        if (!liquidacionAAnular) return
        setAnulando(true)
        setErrorAnulacion('')
        try {
            const res = await fetch(`/api/liquidaciones/${liquidacionAAnular.id}/anular`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo: motivoAnulacion }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo anular la liquidación.')
            setLiquidacionAAnular(null)
            setMotivoAnulacion('')
            await Promise.all([fetchLiquidaciones(), fetchCajas()])
        } catch (error: unknown) {
            setErrorAnulacion(error instanceof Error ? error.message : 'No se pudo anular la liquidación.')
        } finally {
            setAnulando(false)
        }
    }

    const printRecibo = async (liq: any) => {
        const items = Array.isArray(liq.items) ? liq.items : []
        await imprimirRecibosLiquidacion([{
            empleado: empleadoDatos,
            periodo: liq.periodo,
            fechaGeneracion: liq.fechaGeneracion,
            tipo: liq.tipo,
            horasExtras: Number(liq.horasExtras || 0) + Number(liq.ajusteHorasExtras || 0),
            sueldoProporcional: liq.sueldoProporcional,
            montoHorasNormales: liq.montoHorasNormales,
            montoHorasExtras: liq.montoHorasExtras,
            montoHorasFeriado: liq.montoHorasFeriado,
            montoAdicionales: items.reduce((total: number, item: any) => total + Number(item.montoCalculado || 0), 0),
            descuentos: liq.descuentosPrestamos,
            totalNeto: liq.totalNeto,
            desglose: liq.desglose,
            conceptos: items.map((item: any) => ({
                nombre: item.concepto?.nombre || item.detalle || 'Adicional / otro',
                monto: Number(item.montoCalculado || 0),
                detalle: item.detalle || undefined,
            })),
        }], modeloRecibo)
    }

    if (loading) return <div className="p-10 text-center text-gray-400">Cargando liquidaciones...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Cerrar Periodo</h3>
                            <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', maxWidth: '400px' }}>Genera la liquidación tomando el sueldo base, compensación por horas extras/feriados y deduciendo cuotas de préstamos.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '10px' }}>Caja de Pago</label>
                                <select className="form-select" value={cajaSeleccionada} onChange={e => setCajaSeleccionada(e.target.value)}>
                                    {cajas.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre} (${c.saldo.toLocaleString()})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '10px' }}>Concepto</label>
                                <select className="form-select" value={conceptoSeleccionado} onChange={e => setConceptoSeleccionado(e.target.value)}>
                                    <option value="pago_sueldo">💸 Pago Sueldo</option>
                                    {conceptos.filter(c => c.clave !== 'pago_sueldo').map(c => (
                                        <option key={c.id} value={c.clave}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '10px' }}>Tipo</label>
                                <select className="form-select" value={tipoPeriodo} onChange={e => setTipoPeriodo(e.target.value)}>
                                    <option value="mes">Mensual completo</option>
                                    <option value="semana">Rango Personalizado</option>
                                </select>
                            </div>

                            {tipoPeriodo === 'mes' ? (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '10px' }}>Mes</label>
                                    <input
                                        type="month"
                                        value={mes}
                                        onChange={(e) => setMes(e.target.value)}
                                        onClick={(e) => e.currentTarget.showPicker?.()}
                                        className="form-input"
                                        style={{ width: 'auto' }}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '10px' }}>Desde</label>
                                        <input
                                            type="date"
                                            value={fechaDesde}
                                            onChange={(e) => setFechaDesde(e.target.value)}
                                            onClick={(e) => e.currentTarget.showPicker?.()}
                                            className="form-input"
                                            style={{ width: '130px' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '10px' }}>Hasta</label>
                                        <input
                                            type="date"
                                            value={fechaHasta}
                                            onChange={(e) => setFechaHasta(e.target.value)}
                                            onClick={(e) => e.currentTarget.showPicker?.()}
                                            className="form-input"
                                            style={{ width: '130px' }}
                                        />
                                    </div>
                                </>
                            )}

                            <button
                                onClick={handleGenerar}
                                disabled={generando || escaneando || alertas.length > 0}
                                className="btn btn-primary"
                            >
                                {generando ? 'Procesando...' : (escaneando ? 'Validando...' : 'Liquidar y Generar')}
                            </button>
                            <button
                                onClick={() => setExpressModalOpen(true)}
                                className="btn btn-outline"
                                style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                            >
                                💸 Express (Manual)
                            </button>
                        </div>
                    </div>

                    {/* Banner de Validación */}
                    {(escaneando || alertas.length > 0) && (
                        <div style={{
                            marginTop: 'var(--space-4)',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: alertas.length > 0 ? 'var(--color-danger-bg)' : 'var(--color-info-bg)',
                            color: alertas.length > 0 ? 'var(--color-danger)' : 'var(--color-info)',
                            border: alertas.length > 0 ? '1px solid var(--color-danger)' : '1px solid var(--color-info)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)'
                        }}>
                            {escaneando ? (
                                <>
                                    <span className="spinner" style={{ width: '16px', height: '16px', borderTopColor: 'currentColor' }}></span>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Validando datos de asistencia...</span>
                                </>
                            ) : (
                                <>
                                    <span style={{ fontSize: '20px' }}>⚠️</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>Inconsistencias detectadas:</p>
                                        <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                                            {alertas.map((a, i) => (
                                                <li key={i}>{a}</li>
                                            ))}
                                        </ul>
                                        <p style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8 }}>Debes corregir estas marcas en la pestaña 'Fichadas' antes de liquidar.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div>
                        <h4 style={{ fontWeight: 600, color: 'var(--color-gray-700)', margin: 0 }}>Historial de Recibos Generados</h4>
                        <p style={{ margin: '4px 0 0', color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)' }}>El modelo elegido se usa al imprimir cualquier recibo del historial.</p>
                    </div>
                    <label style={{ display: 'grid', gap: '4px', minWidth: '220px' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', fontWeight: 600 }}>Modelo de impresión</span>
                        <select className="form-select" value={modeloRecibo} onChange={e => setModeloRecibo(e.target.value as ModeloRecibo)}>
                            {MODELOS_RECIBO.map(modelo => <option key={modelo.value} value={modelo.value}>{modelo.label}</option>)}
                        </select>
                    </label>
                </div>

                {liquidaciones.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                        <p style={{ color: 'var(--color-gray-500)' }}>No hay liquidaciones históricas para este empleado.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                        {liquidaciones.map(liq => {
                            const anulada = liq.estado === 'anulado'
                            const movimientoPago = liq.movimientosCaja?.find((movimiento: any) => movimiento.tipo === 'egreso' && !movimiento.movimientoReversaDeId)
                            return (
                            <div key={liq.id} className="card" style={{ transition: 'border-color 0.2s', opacity: anulada ? .78 : 1, ':hover': { borderColor: 'var(--color-primary)' } } as React.CSSProperties}>
                                <div className="card-body" style={{ padding: 'var(--space-5)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                                        <div>
                                            <div className={`badge ${anulada ? 'badge-danger' : 'badge-success'}`} style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {anulada ? 'Anulada' : liq.periodo}
                                            </div>
                                            {anulada && <div style={{ marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>{liq.periodo}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                            <button
                                                onClick={() => printRecibo(liq)}
                                                className="btn btn-ghost btn-icon btn-sm"
                                                title={`Imprimir Modelo ${modeloRecibo}`}
                                            >
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            </button>
                                            {esAdmin && !anulada && movimientoPago && <CambiarCajaPagoButton
                                                compact
                                                label="Caja"
                                                movimientoId={movimientoPago.id}
                                                cajaActual={movimientoPago.cajaOrigen}
                                                onSuccess={async () => {
                                                    await fetchLiquidaciones()
                                                    await fetchCajas()
                                                }}
                                            />}
                                            {esAdmin && !anulada && <button
                                                onClick={() => {
                                                    setLiquidacionAAnular(liq)
                                                    setMotivoAnulacion('')
                                                    setErrorAnulacion('')
                                                }}
                                                className="btn btn-ghost btn-icon btn-sm text-danger"
                                                title="Anular liquidación"
                                                style={{ color: 'var(--color-danger)' }}
                                            >
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>}
                                        </div>
                                    </div>

                                    {anulada && <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                                        <strong>Anulada{liq.anuladoAt ? ` el ${new Date(liq.anuladoAt).toLocaleDateString('es-AR')}` : ''}</strong>
                                        {liq.anuladoPor && ` por ${liq.anuladoPor.nombre} ${liq.anuladoPor.apellido || ''}`}
                                        {liq.motivoAnulacion && <div style={{ marginTop: 4 }}>{liq.motivoAnulacion}</div>}
                                    </div>}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                                            <span style={{ color: 'var(--color-gray-500)' }}>Total Haberes</span>
                                            <span style={{ fontWeight: 500, color: 'var(--color-gray-900)' }}>${(liq.sueldoProporcional + liq.montoHorasNormales + liq.montoHorasExtras + liq.montoHorasFeriado).toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                                            <span style={{ color: 'var(--color-danger)', opacity: 0.8 }}>Deducciones (Préstamos)</span>
                                            <span style={{ fontWeight: 500, color: 'var(--color-danger)' }}>-${liq.descuentosPrestamos.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-lg)', fontWeight: 'bold' }}>
                                        <span style={{ color: 'var(--color-gray-900)' }}>Neto:</span>
                                        <span style={{ color: 'var(--color-success)' }}>${liq.totalNeto.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                )}
            </div>

            {/* Modal de anulación trazable */}
            {liquidacionAAnular && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0, color: 'var(--color-danger)' }}>Anular liquidación</h3>
                            <button disabled={anulando} onClick={() => setLiquidacionAAnular(null)} className="btn btn-ghost btn-icon">✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginTop: 0 }}>Se conservará el recibo original, se restaurarán las cuotas asociadas y se generará un ingreso compensatorio en la caja original.</p>
                            <div style={{ padding: 'var(--space-3)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                <strong>{liquidacionAAnular.periodo}</strong>
                                <div style={{ marginTop: 4, color: 'var(--color-gray-600)' }}>Neto: ${liquidacionAAnular.totalNeto.toLocaleString('es-AR')}</div>
                            </div>
                            <label className="form-label" htmlFor="motivo-anulacion-liquidacion">Motivo de la anulación</label>
                            <textarea
                                id="motivo-anulacion-liquidacion"
                                className="form-input"
                                rows={4}
                                maxLength={500}
                                value={motivoAnulacion}
                                onChange={evento => setMotivoAnulacion(evento.target.value)}
                                placeholder="Ej. Liquidación cargada por duplicado"
                                disabled={anulando}
                            />
                            <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>Entre 10 y 500 caracteres · {motivoAnulacion.trim().length}/500</div>
                            {errorAnulacion && <div style={{ marginTop: 'var(--space-3)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{errorAnulacion}</div>}
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                            <button disabled={anulando} onClick={() => setLiquidacionAAnular(null)} className="btn btn-outline" style={{ borderColor: 'var(--color-gray-400)', color: 'var(--color-gray-700)' }}>Cancelar</button>
                            <button disabled={anulando || motivoAnulacion.trim().length < 10} onClick={() => void confirmarAnulacion()} className="btn btn-primary" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>{anulando ? 'Anulando…' : 'Confirmar anulación'}</button>
                        </div>
                    </div>
                </div>
            )}

            {expressModalOpen && (
                <ExpressLiquidationModal
                    empleado={empleadoDatos}
                    onClose={() => setExpressModalOpen(false)}
                    onSuccess={() => fetchLiquidaciones()}
                />
            )}
        </div>
    )
}
