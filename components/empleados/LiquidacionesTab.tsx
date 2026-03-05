"use client"

import { useState, useEffect } from 'react'
import { Empleado } from '@prisma/client'

export function LiquidacionesTab({ empleadoId, empleadoDatos }: { empleadoId: string, empleadoDatos: any }) {
    const [liquidaciones, setLiquidaciones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [generando, setGenerando] = useState(false)
    const [mes, setMes] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM

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

    useEffect(() => {
        fetchLiquidaciones()
    }, [empleadoId])

    const handleGenerar = async () => {
        if (!confirm(`¿Generar liquidación de ${empleadoDatos.cicloPago} para el periodo ${mes}? Se cerrarán las horas y se descontarán las cuotas de préstamos activos.`)) return

        setGenerando(true)
        try {
            // Calculamos inicio y fin de mes simples para el demo
            const fechaInicio = `${mes}-01T00:00:00.000Z`
            let d = new Date(fechaInicio)
            d.setMonth(d.getMonth() + 1)
            const fechaFin = d.toISOString()

            const res = await fetch('/api/liquidaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    periodo: `${empleadoDatos.cicloPago} - ${mes}`,
                    fechaInicio,
                    fechaFin
                })
            })

            if (res.ok) {
                alert('Liquidación generada con éxito')
                fetchLiquidaciones()
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
                            <td>Sueldo Base (${empleadoDatos.cicloPago})</td>
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
                <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Cerrar Periodo</h3>
                        <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', maxWidth: '400px' }}>Genera la liquidación tomando el sueldo base, compensación por horas extras/feriados y deduciendo cuotas de préstamos.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <input
                            type="month"
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            className="form-input"
                            style={{ width: 'auto' }}
                        />
                        <button
                            onClick={handleGenerar}
                            disabled={generando}
                            className="btn btn-primary"
                        >
                            {generando ? 'Procesando...' : 'Liquidar y Generar Recibo'}
                        </button>
                    </div>
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
                                        <button
                                            onClick={() => printRecibo(liq)}
                                            className="btn btn-ghost btn-icon btn-sm"
                                            title="Imprimir PDF"
                                        >
                                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        </button>
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
