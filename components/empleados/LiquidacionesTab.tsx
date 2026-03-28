"use client"

import { useState, useEffect } from 'react'
import { Empleado } from '@prisma/client'
import { ExpressLiquidationModal } from '@/components/empleados/ExpressLiquidationModal'
import { formatCurrencyToWords } from '@/lib/utils/numberToWords'


export function LiquidacionesTab({ empleadoId, empleadoDatos }: { empleadoId: string, empleadoDatos: any }) {
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
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const fetchLiquidaciones = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/liquidaciones?empleadoId=${empleadoId}&t=${Date.now()}`)
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

    const executeDelete = async () => {
        if (!confirmDeleteId) return
        const id = confirmDeleteId
        setConfirmDeleteId(null) // Cerrar antes de procesar

        try {
            const res = await fetch(`/api/liquidaciones?id=${id}`, {
                method: 'DELETE',
                cache: 'no-store'
            })

            if (res.ok) {
                // Liquidación eliminada correctamente
                fetchLiquidaciones()
                fetchCajas()
            } else {
                const err = await res.json()
                console.error(err.error || 'Error al eliminar')
            }
        } catch (error) {
            console.error('Error de red al eliminar', error)
        }
    }

    const printRecibo = (liq: any) => {
        const dImp = new Date(liq.fechaGeneracion || new Date())
        const dia = dImp.getDate()
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        const mesNombre = meses[dImp.getMonth()]
        const anio = dImp.getFullYear()

        // Extraer fechas del periodo si es posible
        let periodoTexto = liq.periodo || ''
        let matchExpress = periodoTexto.match(/Express\s+([\d\/]+)\s+-\s+([\d\/]+)/)
        let fDesde = '', fHasta = ''
        if (matchExpress) {
            fDesde = matchExpress[1]
            fHasta = matchExpress[2]
        } else {
            let matchNormal = periodoTexto.match(/del\s+([\d\/]+)\s+al\s+([\d\/]+)/i)
            if (matchNormal) {
                fDesde = matchNormal[1]
                fHasta = matchNormal[2]
            } else {
                fDesde = liq.periodo
                fHasta = liq.periodo
            }
        }

        const sueldoBaseLetras = formatCurrencyToWords(liq.sueldoProporcional || 0)
        const montoHsExtrasLetras = formatCurrencyToWords(liq.montoHorasExtras || 0)
        
        // El usuario solicitó que el texto del recibo indique el importe íntegro de sueldo + extras antes de descuentos
        const totalBruto = (liq.sueldoProporcional || 0) + (liq.montoHorasExtras || 0) + (liq.montoHorasNormales || 0) + (liq.montoHorasFeriado || 0)
        const totalLetras = formatCurrencyToWords(totalBruto)

        const html = `
            <html>
            <head>
                <title>Recibo de Sueldo - ${empleadoDatos.nombre}</title>
                <style>
                    @page { size: A4; margin: 20mm; }
                    body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #000; padding: 20px; font-size: 14pt; }
                    .recibo-container { border: 1px solid #eee; padding: 40px; max-width: 800px; margin: 0 auto; position: relative; z-index: 1; background: transparent !important; }
                    .watermark {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 80%;
                        max-width: 500px;
                        height: auto;
                        opacity: 0.35; /* Opacidad aumentada a pedido del usuario */
                        z-index: 0;
                        pointer-events: none;
                    }
                    .header { margin-bottom: 40px; position: relative; z-index: 10; }
                    .texto { text-align: justify; margin-bottom: 60px; position: relative; z-index: 10; padding-top: 20px; }
                    .firma-section { display: flex; flex-direction: column; align-items: flex-end; gap: 20px; margin-top: 80px; position: relative; z-index: 10; }
                    .firma-line { border-top: 1px solid #000; width: 250px; text-align: center; padding-top: 5px; }
                    .data-label { font-weight: bold; }
                    .amount { font-weight: bold; }
                    @media print { 
                        .no-print { display: none; } 
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                </style>
            </head>
            <body>
                <div class="recibo-container">
                    <img src="${window.location.origin}/logo-watermark.png" class="watermark" alt="Logo Santa Catalina" />
                    
                    <div class="header">
                        <p>Berazategui, ${dia} de ${mesNombre} de ${anio}</p>
                    </div>

                    <div class="texto">
                        Recibo la cantidad de <span class="amount">$${(liq.sueldoProporcional || 0).toLocaleString()}</span> 
                        (pesos ${sueldoBaseLetras}) en concepto de pago por semana laboral y 
                        <span class="amount">$${(liq.montoHorasExtras || 0).toLocaleString()}</span> 
                        (pesos ${montoHsExtrasLetras}) en concepto de horas extras al 100% más de su valor 
                        del <span class="data-label">${fDesde}</span> al <span class="data-label">${fHasta}</span>. 
                        Recibiendo un total de <span class="amount">$${totalBruto.toLocaleString()}</span> 
                        (pesos ${totalLetras}).
                    </div>

                    <div class="firma-section">
                        <div class="firma-line">Firma</div>
                        <div style="width: 250px;">Aclaración: ${empleadoDatos.nombre} ${empleadoDatos.apellido || ''}</div>
                        <div style="width: 250px;">D.N.I: ${empleadoDatos.dni || ''}</div>
                    </div>
                </div>
                <script>
                    let printed = false;
                    const doPrint = () => {
                        if (printed) return;
                        printed = true;
                        window.print();
                    };
                    const img = document.querySelector('.watermark');
                    if (img && !img.complete) {
                        img.onload = doPrint;
                        img.onerror = doPrint;
                        setTimeout(doPrint, 1500);
                    } else {
                        doPrint();
                    }
                </script>
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
                                                onClick={() => setConfirmDeleteId(liq.id)}
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

            {/* Modal de confirmación de borrado */}
            {confirmDeleteId && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0, color: 'var(--color-danger)' }}>Eliminar Liquidación</h3>
                            <button onClick={() => setConfirmDeleteId(null)} className="btn btn-ghost btn-icon">✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginTop: 0 }}>¿Estás seguro de que quieres eliminar esta liquidación?</p>
                            <p style={{ color: 'var(--color-gray-500)', fontSize: '12px' }}>Se devolverá el dinero a la caja y se restaurarán los préstamos involucrados.</p>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                            <button onClick={() => setConfirmDeleteId(null)} className="btn btn-outline" style={{ borderColor: 'var(--color-gray-400)', color: 'var(--color-gray-700)' }}>Cancelar</button>
                            <button onClick={executeDelete} className="btn btn-primary" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>Sí, Eliminar</button>
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
