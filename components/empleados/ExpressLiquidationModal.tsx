"use client"

import { useState, useEffect } from 'react'
import { formatCurrencyToWords } from '@/lib/utils/numberToWords'

interface ExpressLiquidationModalProps {
    empleado: any
    onClose: () => void
    onSuccess: () => void
}

export function ExpressLiquidationModal({ empleado, onClose, onSuccess }: ExpressLiquidationModalProps) {
    const [sueldoBase, setSueldoBase] = useState<number | ''>('')
    const [horasExtras, setHorasExtras] = useState<number | ''>('')
    const [montoHsExtras, setMontoHsExtras] = useState<number | ''>('')
    const [descuentoPrestamos, setDescuentoPrestamos] = useState<number | ''>('')
    const [licenciaId, setLicenciaId] = useState<string>('')
    const [tiposLicencias, setTiposLicencias] = useState<any[]>([])
    
    // Fechas
    const [fechaDesde, setFechaDesde] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
    const [fechaImpresion, setFechaImpresion] = useState(new Date().toISOString().split('T')[0])
    
    // Cajas
    const [cajas, setCajas] = useState<any[]>([])
    const [cajaSeleccionada, setCajaSeleccionada] = useState('caja_madre')
    
    const [guardando, setGuardando] = useState(false)

    useEffect(() => {
        const fetchCajas = async () => {
            const res = await fetch('/api/caja/saldos')
            const data = await res.json()
            setCajas([
                { id: 'caja_madre', nombre: 'Caja Madre', saldo: data.cajaMadre?.saldo || 0 },
                { id: 'caja_chica', nombre: 'Caja Chica', saldo: data.cajaChica?.saldo || 0 },
                { id: 'local', nombre: 'Caja Local', saldo: data.local?.saldo || 0 }
            ])
        }

        const fetchLicencias = async () => {
            const res = await fetch('/api/licencias')
            const data = await res.json()
            setTiposLicencias(data.filter((l: any) => l.activo))
        }

        fetchCajas()
        fetchLicencias()
        
        // Cargar valores por defecto del empleado si existen
        if (empleado) {
            // Calcular el proporcional según el ciclo de pago (semanal /4, quincenal /2)
            let base = empleado.sueldoBaseMensual
            if (empleado.cicloPago === 'SEMANAL') {
                base = empleado.sueldoBaseMensual / 4.3
            } else if (empleado.cicloPago === 'QUINCENAL') {
                base = empleado.sueldoBaseMensual / 2
            }
            setSueldoBase(Math.round(base))
        }
    }, [empleado])

    const valSueldo = Number(sueldoBase) || 0
    const valExtras = Number(montoHsExtras) || 0
    const valPrestamos = Number(descuentoPrestamos) || 0

    const totalNeto = valSueldo + valExtras - valPrestamos

    const handleGuardarYImprimir = async () => {
        if (totalNeto <= 0 && !confirm('El total es 0 o negativo. ¿Deseas continuar?')) return
        
        setGuardando(true)
        try {
            const res = await fetch('/api/liquidaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId: empleado.id,
                    periodo: `Express ${fechaDesde.split('-').reverse().join('/')} - ${fechaHasta.split('-').reverse().join('/')}`,
                    fechaInicio: `${fechaDesde}T00:00:00.000Z`,
                    fechaFin: `${fechaHasta}T23:59:59.999Z`,
                    cajaId: cajaSeleccionada,
                    concepto: 'pago_sueldo',
                    manualData: {
                        sueldoBase: valSueldo,
                        horasExtras: Number(horasExtras) || 0,
                        montoHsExtras: valExtras,
                        descuentoPrestamos: valPrestamos,
                        diasTrabajados: 6 // Placeholder
                    }
                })
            })

            if (res.ok) {
                const liq = await res.json()
                printRecibo(liq)
                onSuccess()
                onClose()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al guardar liquidación')
            }
        } catch (error) {
            console.error(error)
            alert('Error en la petición')
        } finally {
            setGuardando(false)
        }
    }

    const printRecibo = (liq: any) => {
        const dImp = new Date(fechaImpresion + 'T12:00:00')
        const dia = dImp.getDate()
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        const mesNombre = meses[dImp.getMonth()]
        const anio = dImp.getFullYear()

        const fDesde = fechaDesde.split('-').reverse().join('/')
        const fHasta = `${fechaHasta.split('-')[2]}/${fechaHasta.split('-')[1]}/${fechaHasta.split('-')[0]}`

        const sueldoBaseLetras = formatCurrencyToWords(valSueldo)
        const montoHsExtrasLetras = formatCurrencyToWords(valExtras)
        const totalBruto = valSueldo + valExtras
        const totalLetras = formatCurrencyToWords(totalBruto)

        const licenciaActiva = tiposLicencias.find(l => l.id === licenciaId)
        const textoLicencia = licenciaActiva ? ` Asimismo, se contemplan días correspondientes a licencia por ${licenciaActiva.nombre}.` : ''

        const html = `
            <html>
            <head>
                <title>Recibo de Sueldo Express</title>
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
                        z-index: 0;   /* Ya no está detrás del fondo, sino encima pero debajo del texto (z-index: 1) */
                        pointer-events: none;
                    }
                    .header { margin-bottom: 40px; position: relative; z-index: 10; }
                    .texto { text-align: justify; margin-bottom: 60px; position: relative; z-index: 10; }
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
                        Recibo la cantidad de <span class="amount">$${valSueldo.toLocaleString()}</span> 
                        (pesos ${sueldoBaseLetras}) en concepto de pago por semana laboral y 
                        <span class="amount">$${valExtras.toLocaleString()}</span> 
                        (pesos ${montoHsExtrasLetras}) en concepto de horas extras al 100% más de su valor 
                        del <span class="data-label">${fDesde}</span> al <span class="data-label">${fHasta}</span>.${textoLicencia} 
                        Recibiendo un total de <span class="amount">$${totalBruto.toLocaleString()}</span> 
                        (pesos ${totalLetras}).
                    </div>

                    <div class="firma-section">
                        <div class="firma-line">Firma</div>
                        <div style="width: 250px;">Aclaración: ${empleado.nombre} ${empleado.apellido || ''}</div>
                        <div style="width: 250px;">D.N.I: ${empleado.dni || ''}</div>
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
                <div className="modal-header">
                    <h2>💸 Liquidación Express</h2>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-primary-bg)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)' }}>
                        <div style={{ fontWeight: 600 }}>{empleado.nombre} {empleado.apellido}</div>
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>Sueldo Base: ${empleado.sueldoBaseMensual.toLocaleString()} ({empleado.cicloPago})</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label">Desde</label>
                            <input type="date" className="form-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Hasta</label>
                            <input type="date" className="form-input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Importe Pagado (Sueldo/Semana)</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }}>$</span>
                            <input type="number" className="form-input" style={{ paddingLeft: '25px' }} value={sueldoBase} onChange={e => setSueldoBase(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                            pesos {formatCurrencyToWords(valSueldo)}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="form-label">Horas Extras (cant.)</label>
                            <input type="number" className="form-input" value={horasExtras} onChange={e => {
                                const val = e.target.value === '' ? '' : Number(e.target.value)
                                setHorasExtras(val)
                                // Auto-calcular monto si el empleado tiene valor hora extra configurado
                                if (empleado?.valorHoraExtra && empleado.valorHoraExtra > 0 && val !== '') {
                                    setMontoHsExtras(Math.round(Number(val) * empleado.valorHoraExtra))
                                }
                            }} />
                            {empleado?.valorHoraExtra > 0 && (
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '2px', display: 'block' }}>
                                    Valor/hora: ${empleado.valorHoraExtra.toLocaleString('es-AR')}
                                </span>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Monto Horas Extras</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }}>$</span>
                                <input type="number" className="form-input" style={{ paddingLeft: '25px' }} value={montoHsExtras} onChange={e => setMontoHsExtras(e.target.value === '' ? '' : Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Descuento Préstamos/Adelantos</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-danger)' }}>-$</span>
                            <input type="number" className="form-input" style={{ paddingLeft: '25px', color: 'var(--color-danger)' }} value={descuentoPrestamos} onChange={e => setDescuentoPrestamos(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Incluir Licencia (Opcional)</label>
                        <select className="form-select" value={licenciaId} onChange={e => setLicenciaId(e.target.value)}>
                            <option value="">-- Ninguna --</option>
                            {tiposLicencias.map(l => (
                                <option key={l.id} value={l.id}>{l.nombre} {l.conGoceSueldo ? '(Remunerada)' : ''}</option>
                            ))}
                        </select>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px', display: 'block' }}>Si se selecciona, figurará en el texto del recibo.</span>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Fecha de "Impresión"</label>
                        <input type="date" className="form-input" value={fechaImpresion} onChange={e => setFechaImpresion(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Caja de Salida</label>
                        <select className="form-select" value={cajaSeleccionada} onChange={e => setCajaSeleccionada(e.target.value)}>
                            {cajas.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre} (${c.saldo.toLocaleString()})</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ 
                        marginTop: 'var(--space-2)', 
                        padding: 'var(--space-4)', 
                        background: 'var(--color-gray-900)', 
                        color: 'white', 
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Total Neto:</span>
                        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>${totalNeto.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textAlign: 'center', fontStyle: 'italic' }}>
                        (pesos {formatCurrencyToWords(totalNeto)})
                    </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" disabled={guardando} onClick={handleGuardarYImprimir}>
                        {guardando ? 'Guardando...' : 'Guardar e Imprimir Recibo'}
                    </button>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(2px); }
                .modal { background: white; border-radius: var(--radius-lg); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
