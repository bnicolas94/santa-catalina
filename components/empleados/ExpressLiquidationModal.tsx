"use client"

import { useState, useEffect, useMemo } from 'react'
import { formatCurrencyToWords } from '@/lib/utils/numberToWords'
import { getPrintLogos } from '@/lib/utils/printLogos'
import { seleccionarCuotasVencidasPorPrestamo } from '@/lib/payroll/prestamos'

interface CuotaPrestamoExpress {
    id: string
    numeroCuota: number
    monto: number
    estado: string
    fechaVencimiento: string
    liquidacionId: string | null
    prestamoId: string
}

interface PrestamoExpress {
    id: string
    cuotas: Omit<CuotaPrestamoExpress, 'prestamoId'>[]
}

interface LiquidacionExpressCreada {
    descuentosPrestamos: number
    totalNeto: number
    cuotasDescontadas?: Array<{
        id: string
        numeroCuota: number
        monto: number
        prestamoId: string
    }>
}

interface EmpleadoExpress {
    id: string
    nombre: string
    apellido?: string | null
    dni?: string | null
    sueldoBaseMensual: number
    cicloPago?: string | null
    valorHoraExtra?: number | null
    rolRel?: {
        nombre: string
        jornal: number
        valorHoraExtra: number
    } | null
}

interface TipoLicenciaExpress {
    id: string
    nombre: string
    activo: boolean
    conGoceSueldo: boolean
}

interface ConceptoSalarialExpress {
    id: string
    nombre: string
    activo: boolean
    tipo: string
    valorPorDefecto?: number | null
    esPorcentaje?: boolean
}

interface CajaExpress {
    id: string
    nombre: string
    saldo: number
}

function escaparHtml(valor: unknown): string {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}

interface ExpressLiquidationModalProps {
    empleado: EmpleadoExpress
    onClose: () => void
    onSuccess: () => void
}

export function ExpressLiquidationModal({ empleado, onClose, onSuccess }: ExpressLiquidationModalProps) {
    const [sueldoBase, setSueldoBase] = useState<number | ''>('')
    const [horasExtras, setHorasExtras] = useState<number | ''>('')
    const [montoHsExtras, setMontoHsExtras] = useState<number | ''>('')
    const [prestamos, setPrestamos] = useState<PrestamoExpress[]>([])
    const [prestamosLoading, setPrestamosLoading] = useState(true)
    const [prestamosError, setPrestamosError] = useState('')
    const [licenciaId, setLicenciaId] = useState<string>('')
    const [tiposLicencias, setTiposLicencias] = useState<TipoLicenciaExpress[]>([])
    
    // Conceptos Salariales Adicionales
    const [conceptosConfig, setConceptosConfig] = useState<ConceptoSalarialExpress[]>([])
    const [adicionales, setAdicionales] = useState<{ conceptoSalarialId: string, nombre: string, montoCalculado: number }[]>([])
    const [nuevoAdicionalId, setNuevoAdicionalId] = useState('')
    const [nuevoAdicionalMonto, setNuevoAdicionalMonto] = useState<number | ''>('')
    
    // Fechas: Default a Lunes y Domingo de la semana actual
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
    const [fechaImpresion, setFechaImpresion] = useState(new Date().toISOString().split('T')[0])
    
    // Cajas
    const [cajas, setCajas] = useState<CajaExpress[]>([])
    const [cajaSeleccionada, setCajaSeleccionada] = useState('caja_madre')
    
    const [guardando, setGuardando] = useState(false)

    useEffect(() => {
        const fetchCajas = async () => {
            const res = await fetch('/api/caja/saldos')
            const data = await res.json() as {
                cajaMadre?: { saldo?: number }
                cajaChica?: { saldo?: number }
                local?: { saldo?: number }
            }
            setCajas([
                { id: 'caja_madre', nombre: 'Caja Madre', saldo: data.cajaMadre?.saldo || 0 },
                { id: 'caja_chica', nombre: 'Caja Chica', saldo: data.cajaChica?.saldo || 0 },
                { id: 'local', nombre: 'Caja Local', saldo: data.local?.saldo || 0 }
            ])
        }

        const fetchLicencias = async () => {
            const res = await fetch('/api/licencias')
            const data = await res.json() as TipoLicenciaExpress[]
            setTiposLicencias(data.filter(licencia => licencia.activo))
        }

        const fetchConceptos = async () => {
            const res = await fetch('/api/conceptos-salariales')
            const data = await res.json() as ConceptoSalarialExpress[]
            setConceptosConfig(data.filter(concepto => concepto.activo))
        }

        const fetchPrestamos = async () => {
            setPrestamosLoading(true)
            setPrestamosError('')
            try {
                const res = await fetch(`/api/empleados/${empleado.id}/prestamos`)
                if (!res.ok) throw new Error('No se pudieron consultar las cuotas del empleado.')
                const data = await res.json()
                setPrestamos(Array.isArray(data) ? data : [])
            } catch (error) {
                setPrestamosError(error instanceof Error ? error.message : 'No se pudieron consultar las cuotas del empleado.')
            } finally {
                setPrestamosLoading(false)
            }
        }

        fetchCajas()
        fetchLicencias()
        fetchConceptos()
        fetchPrestamos()
        
        // Cargar valores por defecto del empleado si existen
        if (empleado) {
            // Prioridad: 1) Jornal del Rol, 2) Sueldo base individual del empleado
            const rolJornal = empleado.rolRel?.jornal || 0
            const sueldoIndiv = empleado.sueldoBaseMensual || 0
            
            let base = rolJornal > 0 ? rolJornal : sueldoIndiv
            
            // Si usamos sueldoBaseMensual individual (y no el del rol), calcular proporcional según ciclo de pago
            if (rolJornal <= 0 && sueldoIndiv > 0) {
                if (empleado.cicloPago === 'SEMANAL') {
                    base = sueldoIndiv / 4.3
                } else if (empleado.cicloPago === 'QUINCENAL') {
                    base = sueldoIndiv / 2
                }
            }
            setSueldoBase(Math.round(base))
        }
    }, [empleado])

    // Determinar el valor hora extra efectivo: prioridad empleado > rol
    const valorHoraExtraEfectivo = (empleado?.valorHoraExtra && empleado.valorHoraExtra > 0)
        ? empleado.valorHoraExtra
        : (empleado?.rolRel?.valorHoraExtra || 0)
    const jornalRolEfectivo = empleado.rolRel?.jornal || 0
    const usaValorHoraExtraRol = (empleado.rolRel?.valorHoraExtra || 0) > 0 && !(empleado.valorHoraExtra && empleado.valorHoraExtra > 0)

    const valSueldo = Number(sueldoBase) || 0
    const valExtras = Number(montoHsExtras) || 0
    const cuotasADescontar = useMemo(() => {
        if (!fechaHasta) return []
        const finPeriodo = new Date(`${fechaHasta}T00:00:00-03:00`)
        const finExclusivo = new Date(finPeriodo.getTime() + 24 * 60 * 60 * 1000)
        const cuotas = prestamos.flatMap(prestamo =>
            prestamo.cuotas.map(cuota => ({ ...cuota, prestamoId: prestamo.id })),
        )
        return seleccionarCuotasVencidasPorPrestamo(cuotas, finExclusivo)
    }, [fechaHasta, prestamos])
    const valPrestamos = cuotasADescontar.reduce((total, cuota) => total + cuota.monto, 0)
    const valAdicionales = adicionales.reduce((acc, ad) => acc + ad.montoCalculado, 0)

    const totalNeto = valSueldo + valExtras + valAdicionales - valPrestamos

    const handleAddAdicional = () => {
        if (!nuevoAdicionalId || !nuevoAdicionalMonto) return
        const concepto = conceptosConfig.find(c => c.id === nuevoAdicionalId)
        if (!concepto) return

        let monto = Number(nuevoAdicionalMonto)
        if (concepto.tipo === 'DESCUENTO') monto = -Math.abs(monto)

        setAdicionales([...adicionales, { conceptoSalarialId: concepto.id, nombre: concepto.nombre, montoCalculado: monto }])
        setNuevoAdicionalId('')
        setNuevoAdicionalMonto('')
    }

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
                    fechaInicio: fechaDesde,
                    fechaFin: fechaHasta,
                    cajaId: cajaSeleccionada,
                    concepto: 'pago_sueldo',
                    aplicarCuotasPrestamo: true,
                    manualData: {
                        origen: 'LIQUIDACION_EXPRESS',
                        sueldoBase: valSueldo,
                        horasExtras: Number(horasExtras) || 0,
                        montoHsExtras: valExtras,
                        diasTrabajados: 6 // Placeholder
                    },
                    adicionales: adicionales.map(a => ({
                        conceptoSalarialId: a.conceptoSalarialId,
                        montoCalculado: a.montoCalculado,
                        detalle: 'Manual Express'
                    }))
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

    const printRecibo = async (liq: LiquidacionExpressCreada) => {
        const dImp = new Date(fechaImpresion + 'T12:00:00')
        const dia = dImp.getDate()
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        const mesNombre = meses[dImp.getMonth()]
        const anio = dImp.getFullYear()

        const fDesde = fechaDesde.split('-').reverse().join('/')
        const fHasta = `${fechaHasta.split('-')[2]}/${fechaHasta.split('-')[1]}/${fechaHasta.split('-')[0]}`

        const descuentoPrestamosReal = Number(liq.descuentosPrestamos) || 0
        const totalNetoReal = Number(liq.totalNeto) || 0
        const totalLetras = formatCurrencyToWords(totalNetoReal)

        const { logo: logoBase64, watermark: watermarkBase64 } = await getPrintLogos()

        const licenciaActiva = tiposLicencias.find(l => l.id === licenciaId)
        const textoLicencia = licenciaActiva ? ` Asimismo, se contemplan días correspondientes a licencia por ${escaparHtml(licenciaActiva.nombre)}.` : ''
        const detalleAdicionales = adicionales.map(adicional => `
            <div class="detalle-fila"><span>${escaparHtml(adicional.nombre)}</span><strong>${adicional.montoCalculado >= 0 ? '+' : '-'}$${Math.abs(adicional.montoCalculado).toLocaleString('es-AR')}</strong></div>
        `).join('')
        const detalleCuotas = (liq.cuotasDescontadas || []).map(cuota => `Cuota ${cuota.numeroCuota}: $${cuota.monto.toLocaleString('es-AR')}`).join(' · ')

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
                    .detalle { position: relative; z-index: 10; margin: 28px 0; border: 1px solid #bbb; border-radius: 8px; overflow: hidden; }
                    .detalle-fila { display: flex; justify-content: space-between; gap: 24px; padding: 8px 12px; border-bottom: 1px solid #ddd; }
                    .detalle-fila:last-child { border-bottom: 0; }
                    .total-neto { background: #f3f4f6; font-size: 16pt; }
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
                    <img src="${watermarkBase64}" class="watermark" alt="Logo Santa Catalina" />
                    
                    <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <img src="${logoBase64}" style="height: 60px;" />
                        <p>Berazategui, ${dia} de ${mesNombre} de ${anio}</p>
                    </div>

                    <div class="texto">
                        Recibo correspondiente al período del <span class="data-label">${fDesde}</span> al <span class="data-label">${fHasta}</span>.${textoLicencia}
                    </div>

                    <div class="detalle">
                        <div class="detalle-fila"><span>Sueldo / semana</span><strong>$${valSueldo.toLocaleString('es-AR')}</strong></div>
                        ${valExtras > 0 ? `<div class="detalle-fila"><span>Horas extras (${Number(horasExtras) || 0} h)</span><strong>+$${valExtras.toLocaleString('es-AR')}</strong></div>` : ''}
                        ${detalleAdicionales}
                        ${descuentoPrestamosReal > 0 ? `<div class="detalle-fila"><span>Cuotas de préstamos${detalleCuotas ? `<br><small>${detalleCuotas}</small>` : ''}</span><strong>-$${descuentoPrestamosReal.toLocaleString('es-AR')}</strong></div>` : ''}
                        <div class="detalle-fila total-neto"><span>Total neto recibido</span><strong>$${totalNetoReal.toLocaleString('es-AR')}</strong></div>
                    </div>

                    <div class="texto">Son pesos ${totalLetras}.</div>

                    <div class="firma-section">
                        <div class="firma-line">Firma</div>
                        <div style="width: 250px;">Aclaración: ${escaparHtml(empleado.nombre)} ${escaparHtml(empleado.apellido || '')}</div>
                        <div style="width: 250px;">D.N.I: ${escaparHtml(empleado.dni || '')}</div>
                    </div>
                </div>
                <script>
                    window.onload = () => {
                        const images = document.querySelectorAll('img');
                        let loaded = 0;
                        if (images.length === 0) return window.print();
                        images.forEach(img => {
                            if (img.complete) {
                                loaded++;
                                if (loaded === images.length) window.print();
                            } else {
                                img.addEventListener('load', () => {
                                    loaded++;
                                    if (loaded === images.length) window.print();
                                });
                                img.addEventListener('error', () => {
                                    loaded++;
                                    if (loaded === images.length) window.print();
                                });
                            }
                        });
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
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>
                            {jornalRolEfectivo > 0 ? (
                                <>Sueldo Base del Rol: ${jornalRolEfectivo.toLocaleString()} ({empleado.cicloPago})</>
                            ) : (
                                <>Sueldo Base Indiv.: ${empleado.sueldoBaseMensual.toLocaleString()} ({empleado.cicloPago})</>
                            )}
                        </div>
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
                                // Auto-calcular monto usando el valor hora extra efectivo
                                if (valorHoraExtraEfectivo > 0 && val !== '') {
                                    setMontoHsExtras(Math.round(Number(val) * valorHoraExtraEfectivo))
                                }
                            }} />
                            {valorHoraExtraEfectivo > 0 && (
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '2px', display: 'block' }}>
                                    Valor/hora: ${valorHoraExtraEfectivo.toLocaleString('es-AR')}
                                    {usaValorHoraExtraRol && empleado.rolRel && (
                                        <> (según rol {empleado.rolRel.nombre})</>
                                    )}
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

                    <div style={{ border: '1px solid var(--color-gray-200)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-50)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                            <div>
                                <div className="form-label" style={{ margin: 0 }}>Préstamos y adelantos</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: 3 }}>
                                    El sistema vincula automáticamente una cuota vencida por préstamo.
                                </div>
                            </div>
                            <strong style={{ color: valPrestamos > 0 ? 'var(--color-danger)' : 'var(--color-gray-500)', whiteSpace: 'nowrap' }}>
                                -${valPrestamos.toLocaleString('es-AR')}
                            </strong>
                        </div>

                        {prestamosLoading ? (
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)', marginTop: 'var(--space-3)' }}>Consultando cuotas...</div>
                        ) : prestamosError ? (
                            <div style={{ padding: 'var(--space-3)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                                {prestamosError}
                            </div>
                        ) : cuotasADescontar.length === 0 ? (
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', marginTop: 'var(--space-3)', fontWeight: 600 }}>Sin cuotas vencidas para este período.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--space-3)' }}>
                                {cuotasADescontar.map(cuota => (
                                    <div key={cuota.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '8px 10px', background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
                                        <span>Cuota {cuota.numeroCuota} · vence {new Date(cuota.fechaVencimiento).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}</span>
                                        <strong>${cuota.monto.toLocaleString('es-AR')}</strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group" style={{ border: '1px dashed var(--color-gray-300)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Conceptos Adicionales (Premios, Bonos, etc.)</span>
                        </label>
                        
                        {adicionales.map((ad, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', border: '1px solid var(--color-gray-200)' }}>
                                <span>{ad.nombre}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <strong style={{ color: ad.montoCalculado < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                        {ad.montoCalculado < 0 ? '' : '+'}${ad.montoCalculado.toLocaleString()}
                                    </strong>
                                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setAdicionales(adicionales.filter((_, i) => i !== idx))} style={{ color: 'var(--color-danger)', height: '24px', width: '24px', padding: 0 }}>✕</button>
                                </div>
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <select className="form-select" style={{ flex: 2 }} value={nuevoAdicionalId} onChange={e => {
                                setNuevoAdicionalId(e.target.value);
                                const conf = conceptosConfig.find(c => c.id === e.target.value);
                                if (conf?.valorPorDefecto) {
                                    if (conf.esPorcentaje) {
                                        setNuevoAdicionalMonto(Math.round(valSueldo * (conf.valorPorDefecto / 100)));
                                    } else {
                                        setNuevoAdicionalMonto(conf.valorPorDefecto);
                                    }
                                } else {
                                    setNuevoAdicionalMonto('');
                                }
                            }}>
                                <option value="">Seleccionar concepto...</option>
                                {conceptosConfig.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre} {c.tipo === 'DESCUENTO' ? '(-)' : '(+)'}</option>
                                ))}
                            </select>
                            <input 
                                type="number" 
                                className="form-input" 
                                style={{ flex: 1 }} 
                                placeholder="$ Monto" 
                                value={nuevoAdicionalMonto} 
                                onChange={e => setNuevoAdicionalMonto(e.target.value === '' ? '' : Number(e.target.value))} 
                            />
                            <button className="btn btn-outline" onClick={handleAddAdicional} disabled={!nuevoAdicionalId || !nuevoAdicionalMonto}>Add</button>
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
                        <label className="form-label">Fecha de impresión</label>
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
                    <button className="btn btn-primary" disabled={guardando || prestamosLoading || Boolean(prestamosError)} onClick={handleGuardarYImprimir}>
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
