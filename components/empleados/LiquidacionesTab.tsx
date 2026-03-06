"use client"

import { useState, useEffect } from 'react'
import { Empleado } from '@prisma/client'

export function LiquidacionesTab({ empleadoId, empleadoDatos }: { empleadoId: string, empleadoDatos: any }) {
    const [liquidaciones, setLiquidaciones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [generando, setGenerando] = useState(false)
    const [mes, setMes] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM
    const [fechaDesde, setFechaDesde] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
    const [tipoPeriodo, setTipoPeriodo] = useState(empleadoDatos.cicloPago === 'SEMANAL' ? 'semana' : 'mes')

    const [cajas, setCajas] = useState<any[]>([])
    const [cajaSeleccionada, setCajaSeleccionada] = useState('caja_madre')
    const [conceptos, setConceptos] = useState<any[]>([])
    const [conceptoSeleccionado, setConceptoSeleccionado] = useState('pago_sueldo')

    const [alertas, setAlertas] = useState<string[]>([])
    const [escaneando, setEscaneando] = useState(false)

    const fetchLiquidaciones = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/liquidaciones?empleadoId=${empleadoId}`)
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
                start = `${mes}-01T00:00:00.000Z`
                let d = new Date(start)
                d.setMonth(d.getMonth() + 1)
                end = d.toISOString()
                perName = `${empleadoDatos.cicloPago} - ${mes}`
            } else {
                start = new Date(`${fechaDesde}T00:00:00.000Z`).toISOString()
                end = new Date(`${fechaHasta}T23:59:59.999Z`).toISOString()
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

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta liquidación? Se devolverá el dinero a la caja y las cuotas de préstamos volverán a estar pendientes.')) return

        try {
            const res = await fetch(`/api/liquidaciones?id=${id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                alert('Liquidación eliminada correctamente')
                fetchLiquidaciones()
                fetchCajas()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al eliminar')
            }
        } catch (error) {
            console.error(error)
            alert('Error al eliminar liquidación')
        }
    }

    const printRecibo = (liq: any) => {
        // En una app real esto abriría un PDF con @react-pdf/renderer o similar
        // Por la limitación de la prueba, abrimos un popup con HTML para imprimir
        const html = `
            <html>
            <head>
                <title>Recibo de Sueldo - ${empleadoDatos.nombre}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .titulo { font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; }
                    .total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #000; padding-top: 10px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>SANTA CATALINA</h1>
                    <h3>RECIBO DE HABERES - ${liq.periodo}</h3>
                </div>
                
                <div class="row">
                    <span class="titulo">Empleado:</span> <span>${empleadoDatos.nombre} ${empleadoDatos.apellido || ''}</span>
                </div>
                <div class="row">
                    <span class="titulo">DNI:</span> <span>${empleadoDatos.dni || '-'}</span>
                </div>
                <div class="row">
                    <span class="titulo">Fecha de Pago:</span> <span>${new Date(liq.fechaGeneracion).toLocaleDateString()}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th>Unidades</th>
                            <th style="text-align: right">Haberes</th>
                            <th style="text-align: right">Deducciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Sueldo Proporcional (${empleadoDatos.cicloPago})</td>
                            <td>1</td>
                            <td style="text-align: right">$${liq.sueldoProporcional.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Horas Normales</td>
                            <td>${liq.horasNormales} hs</td>
                            <td style="text-align: right">$${liq.montoHorasNormales.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Horas Extras (${empleadoDatos.porcentajeHoraExtra}%)</td>
                            <td>${liq.horasExtras} hs</td>
                            <td style="text-align: right">$${liq.montoHorasExtras.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Feriados Trabajados</td>
                            <td>${liq.horasFeriado} hs</td>
                            <td style="text-align: right">$${liq.montoHorasFeriado.toFixed(2)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Descuento Adelantos/Préstamos</td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right">-$${liq.descuentosPrestamos.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="row total">
                    <span>NETO A COBRAR:</span>
                    <span>$${liq.totalNeto.toFixed(2)}</span>
                </div>
                
                <div style="margin-top: 100px; display: flex; justify-content: space-around;">
                    <div style="text-align: center; border-top: 1px solid #000; width: 200px; padding-top: 5px;">Firma Empleador</div>
                    <div style="text-align: center; border-top: 1px solid #000; width: 200px; padding-top: 5px;">Firma Empleado</div>
                </div>
                
                <script>window.print();</script>
            </body>
            </html>
        `
        const win = window.open('', '_blank')
        if (win) {
            win.document.write(html)
            win.document.close()
        }
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
                <h4 style={{ fontWeight: 600, color: 'var(--color-gray-700)' }}>Historial de Recibos Generados</h4>

                {liquidaciones.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                        <p style={{ color: 'var(--color-gray-500)' }}>No hay liquidaciones históricas para este empleado.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                        {liquidaciones.map(liq => (
                            <div key={liq.id} className="card" style={{ transition: 'border-color 0.2s', ':hover': { borderColor: 'var(--color-primary)' } } as React.CSSProperties}>
                                <div className="card-body" style={{ padding: 'var(--space-5)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                                        <div className="badge badge-success" style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {liq.periodo}
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                            <button
                                                onClick={() => printRecibo(liq)}
                                                className="btn btn-ghost btn-icon btn-sm"
                                                title="Imprimir PDF"
                                            >
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(liq.id)}
                                                className="btn btn-ghost btn-icon btn-sm text-danger"
                                                title="Eliminar Liquidación"
                                                style={{ color: 'var(--color-danger)' }}
                                            >
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>

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
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
