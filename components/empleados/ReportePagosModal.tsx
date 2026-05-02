"use client"

import { formatCurrencyToWords } from '@/lib/utils/numberToWords'
import { useState, useEffect, useMemo } from 'react'

interface ReportePagosModalProps {
    onClose: () => void
}

interface ReporteFila {
    id: string
    tipo: string
    manualData: any
    empleado: string
    empleadoDatos: {
        nombre: string
        apellido: string | null
        dni: string | null
    }
    periodo: string
    fechaGeneracion: string
    horasExtras: number
    montoHorasExtras: number
    sueldoProporcional: number
    montoHorasNormales: number
    montoHorasFeriado: number
    totalBruto: number
    montoAdicionales: number
    descuentos: number
    totalNeto: number
}

export function ReportePagosModal({ onClose }: ReportePagosModalProps) {
    const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0])
    const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
    const [datos, setDatos] = useState<ReporteFila[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [filtroNombre, setFiltroNombre] = useState('')

    useEffect(() => {
        fetchReporte()
    }, [fechaDesde, fechaHasta])

    const fetchReporte = async () => {
        setLoading(true)
        setSelectedIds(new Set())
        try {
            const res = await fetch(`/api/liquidaciones/reporte?desde=${fechaDesde}&hasta=${fechaHasta}`)
            if (res.ok) {
                const json = await res.json()
                setDatos(json)
            }
        } catch (error) {
            console.error('Error fetching reporte pagos:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredDatos = useMemo(() => {
        if (!filtroNombre) return datos
        const low = filtroNombre.toLowerCase()
        return datos.filter(d => d.empleado.toLowerCase().includes(low))
    }, [datos, filtroNombre])

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredDatos.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredDatos.map(d => d.id)))
        }
    }

    const totalGeneral = datos.reduce((acc, curr) => acc + curr.totalNeto, 0)

    const handlePrint = () => {
        const dImp = new Date()
        const fDesdeStr = fechaDesde.split('-').reverse().join('/')
        const fHastaStr = fechaHasta.split('-').reverse().join('/')

        const html = `
            <html>
            <head>
                <title>Reporte de Pagos</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm; }
                    body { font-family: Arial, sans-serif; line-height: 1.4; color: #000; font-size: 11pt; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .title { font-size: 16pt; font-weight: bold; margin-bottom: 5px; }
                    .subtitle { font-size: 12pt; color: #444; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: bold; }
                    .number { text-align: right; }
                    .total-row { font-weight: bold; background-color: #eaeaea; }
                    .total-box { border: 2px solid #000; padding: 15px; width: 300px; margin-left: auto; text-align: right; font-size: 14pt; background-color: #f9f9f9; }
                    @media print { 
                        .no-print { display: none; } 
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">REPORTE DE PAGOS (LIQUIDACIONES)</div>
                    <div class="subtitle">Período de emisión: ${fDesdeStr} al ${fHastaStr}</div>
                    <div style="font-size: 9pt; margin-top: 5px;">Generado el ${dImp.toLocaleString('es-AR')}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Empleado</th>
                            <th>Período Disp.</th>
                            <th class="number">Hs. Ext.</th>
                            <th class="number">Monto Ext. ($)</th>
                            <th class="number">Bruto ($)</th>
                            <th class="number">Descuentos ($)</th>
                            <th class="number">Neto a Pagar ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${datos.length > 0 ? datos.map((row, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${row.empleado}</td>
                                <td>${row.periodo}</td>
                                <td class="number">${row.horasExtras}</td>
                                <td class="number">${row.montoHorasExtras.toLocaleString('es-AR')}</td>
                                <td class="number">${row.totalBruto.toLocaleString('es-AR')}</td>
                                <td class="number">${row.descuentos.toLocaleString('es-AR')}</td>
                                <td class="number"><strong>${row.totalNeto.toLocaleString('es-AR')}</strong></td>
                            </tr>
                        `).join('') : '<tr><td colspan="8" style="text-align: center;">No hay recibos emitidos en este rango de fechas.</td></tr>'}
                    </tbody>
                </table>

                <div class="total-box">
                    EFECTIVO TOTAL A SEPARAR:<br/>
                    <strong style="font-size: 18pt;">$${totalGeneral.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                </div>

                <script>
                    window.onload = () => {
                        window.print();
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

    const handlePrintReceipts = () => {
        if (selectedIds.size === 0) return

        const selectedLiquidaciones = datos.filter(d => selectedIds.has(d.id))
        
        let allHtml = `
            <html>
            <head>
                <title>Batch Recibos de Sueldo</title>
                <style>
                    @page { size: A4; margin: 20mm; }
                    body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #000; padding: 0; margin: 0; font-size: 14pt; }
                    .page-break { page-break-after: always; }
                    .recibo-container { border: 1px solid #eee; padding: 40px; max-width: 800px; margin: 0 auto 20px auto; position: relative; z-index: 1; background: transparent !important; }
                    .watermark {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 80%;
                        max-width: 500px;
                        height: auto;
                        opacity: 0.35;
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
        `

        selectedLiquidaciones.forEach((liq, index) => {
            const dImp = new Date(liq.fechaGeneracion || new Date())
            const dia = dImp.getDate()
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
            const mesNombre = meses[dImp.getMonth()]
            const anio = dImp.getFullYear()

            let fDesde = '', fHasta = ''
            const matchExpress = liq.periodo.match(/Express\s+([\d\/]+)\s+-\s+([\d\/]+)/)
            if (matchExpress) {
                fDesde = matchExpress[1]; fHasta = matchExpress[2]
            } else {
                const matchNormal = liq.periodo.match(/del\s+([\d\/]+)\s+al\s+([\d\/]+)/i)
                if (matchNormal) {
                    fDesde = matchNormal[1]; fHasta = matchNormal[2]
                } else {
                    fDesde = liq.periodo; fHasta = liq.periodo
                }
            }

            const sueldoBaseLetras = formatCurrencyToWords(liq.sueldoProporcional || 0)
            const montoHsExtrasLetras = formatCurrencyToWords(liq.montoHorasExtras || 0)
            const montoOtrosLetras = formatCurrencyToWords(liq.montoAdicionales || 0)
            const totalBruto = liq.totalBruto || 0
            const totalLetras = formatCurrencyToWords(liq.totalNeto || 0)

            const isVacaciones = liq.tipo === 'VACACIONES' || 
                                liq.manualData?.esVacaciones === true || 
                                liq.periodo.toLowerCase().includes('vacaciones')

            const manualData = liq.manualData || {}
            const goceInicio = manualData.fechaInicioGoce ? manualData.fechaInicioGoce.split('-').reverse().join('/') : '___'
            const goceFin = manualData.fechaFinGoce ? manualData.fechaFinGoce.split('-').reverse().join('/') : '___'
            const diasVacas = manualData.diasTrabajados || '___'

            let textoHtml = ''
            if (isVacaciones) {
                textoHtml = `
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="text-decoration: underline;">Vacaciones anuales</h2>
                    </div>
                    <p>
                        Se abona la suma <span class="amount">$${(liq.totalNeto || 0).toLocaleString()}</span> 
                        (pesos ${totalLetras}) correspondiente a <span class="data-label">${diasVacas}</span> días corridos 
                        de vacaciones anuales, conforme a la Ley de Contrato de Trabajo N° 20.744.
                    </p>
                    <p>
                        El período de goce fue desde <span class="data-label">${goceInicio}</span> hasta <span class="data-label">${goceFin}</span>, 
                        inclusive, habiendo el empleado usufructuado su licencia anual ordinaria.
                    </p>
                `
            } else {
                textoHtml = `
                    Recibo la cantidad de <span class="amount">$${(liq.sueldoProporcional || 0).toLocaleString()}</span> 
                    (pesos ${sueldoBaseLetras}) en concepto de pago por semana laboral, 
                    <span class="amount">$${(liq.montoHorasExtras || 0).toLocaleString()}</span> 
                    (pesos ${montoHsExtrasLetras}) en concepto de horas extras al 100% más de su valor, 
                    ${(liq.montoAdicionales || 0) !== 0 ? `y <span class="amount">$${(liq.montoAdicionales || 0).toLocaleString()}</span> (pesos ${montoOtrosLetras}) en concepto de adicionales/otros, ` : ''}
                    del <span class="data-label">${fDesde}</span> al <span class="data-label">${fHasta}</span>. 
                    Recibiendo un total neto de <span class="amount">$${(liq.totalNeto || 0).toLocaleString()}</span> 
                    (pesos ${totalLetras}).
                `
            }

            allHtml += `
                <div class="recibo-container ${index < selectedLiquidaciones.length - 1 ? 'page-break' : ''}">
                    <img src="${window.location.origin}/logo-watermark.png" class="watermark" alt="Logo Santa Catalina" />
                    <div class="header">
                        <p>Berazategui, ${dia} de ${mesNombre} de ${anio}</p>
                    </div>
                    <div class="texto">
                        ${textoHtml}
                    </div>
                    <div class="firma-section">
                        <div class="firma-line">Firma</div>
                        <div style="width: 250px;">Aclaración: ${liq.empleadoDatos.nombre} ${liq.empleadoDatos.apellido || ''}</div>
                        <div style="width: 250px;">D.N.I: ${liq.empleadoDatos.dni || ''}</div>
                    </div>
                </div>
            `
        })

        allHtml += `
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 100);
                    }
                </script>
            </body>
            </html>
        `

        const win = window.open('', '_blank')
        if (win) {
            win.document.write(allHtml)
            win.document.close()
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>🖨️ Reporte de Pagos</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
                </div>
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Desde:</label>
                            <input type="date" className="form-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Hasta:</label>
                            <input type="date" className="form-input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Filtrar por nombre:</label>
                            <input type="text" className="form-input" placeholder="Buscar empleado..." value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} />
                        </div>
                    </div>

                    {loading ? (
                        <div className="empty-state" style={{ minHeight: '200px' }}>
                            <div className="spinner"></div>
                            <p>Cargando información monetaria...</p>
                        </div>
                    ) : (
                        <div className="table-container" style={{ maxHeight: '400px' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.size === filteredDatos.length && filteredDatos.length > 0} 
                                                onChange={toggleSelectAll} 
                                            />
                                        </th>
                                        <th>Empleado</th>
                                        <th style={{ textAlign: 'right' }}>Hs Extras</th>
                                        <th style={{ textAlign: 'right' }}>Ingresos ($)</th>
                                        <th style={{ textAlign: 'right' }}>Descuentos ($)</th>
                                        <th style={{ textAlign: 'right', fontWeight: 'bold' }}>Neto Final ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDatos.length > 0 ? (
                                        filteredDatos.map(d => (
                                            <tr key={d.id} onClick={() => toggleSelect(d.id)} style={{ cursor: 'pointer' }}>
                                                <td>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedIds.has(d.id)} 
                                                        onChange={(e) => { e.stopPropagation(); toggleSelect(d.id); }} 
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{d.empleado}</div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{d.periodo}</div>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {d.horasExtras > 0 ? `${d.horasExtras}hs ($${d.montoHorasExtras.toLocaleString('es-AR')})` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>${d.totalBruto.toLocaleString('es-AR')}</td>
                                                <td style={{ textAlign: 'right', color: d.descuentos > 0 ? 'var(--color-danger)' : 'inherit' }}>
                                                    {d.descuentos > 0 ? `-$${d.descuentos.toLocaleString('es-AR')}` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 'var(--text-lg)' }}>
                                                    ${d.totalNeto.toLocaleString('es-AR')}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                                                No se encontraron recibos que coincidan con la búsqueda.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {datos.length > 0 && (
                                    <tfoot>
                                        <tr style={{ backgroundColor: 'var(--color-gray-50)', borderTop: '2px solid var(--color-gray-200)' }}>
                                            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', padding: 'var(--space-4)' }}>
                                                Efectivo a Separar:
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--color-primary)', padding: 'var(--space-4)' }}>
                                                ${totalGeneral.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
                    <button className="btn btn-outline" onClick={handlePrintReceipts} disabled={loading || selectedIds.size === 0}>
                        🖨️ Imprimir Recibos Seleccionados ({selectedIds.size})
                    </button>
                    <button className="btn btn-primary" onClick={handlePrint} disabled={loading || datos.length === 0}>
                        📄 Planilla Resumen
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
