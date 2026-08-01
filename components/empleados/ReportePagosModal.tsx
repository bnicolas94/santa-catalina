"use client"

import { getPrintLogos } from '@/lib/utils/printLogos'
import { useState, useEffect, useMemo } from 'react'
import { imprimirRecibosLiquidacion, MODELOS_RECIBO, type ModeloRecibo } from '@/components/empleados/recibosLiquidacion'

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
    const [modeloRecibo, setModeloRecibo] = useState<ModeloRecibo>('A')

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

    const handlePrint = async () => {
        const dImp = new Date()
        const fDesdeStr = fechaDesde.split('-').reverse().join('/')
        const fHastaStr = fechaHasta.split('-').reverse().join('/')

        const { logo: logoBase64 } = await getPrintLogos()

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
                <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start; text-align: left;">
                    <img src="${logoBase64}" style="height: 60px;" />
                    <div style="text-align: right;">
                        <div class="title">REPORTE DE PAGOS</div>
                        <div class="subtitle">Período: ${fDesdeStr} al ${fHastaStr}</div>
                        <div style="font-size: 9pt;">Generado el ${dImp.toLocaleString('es-AR')}</div>
                    </div>
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

    const handlePrintReceipts = async () => {
        if (selectedIds.size === 0) return
        const selectedLiquidaciones = datos.filter(d => selectedIds.has(d.id))
        await imprimirRecibosLiquidacion(selectedLiquidaciones.map(liq => ({
            empleado: liq.empleadoDatos,
            periodo: liq.periodo,
            fechaGeneracion: liq.fechaGeneracion,
            tipo: liq.tipo,
            horasExtras: liq.horasExtras,
            sueldoProporcional: liq.sueldoProporcional,
            montoHorasNormales: liq.montoHorasNormales,
            montoHorasExtras: liq.montoHorasExtras,
            montoHorasFeriado: liq.montoHorasFeriado,
            montoAdicionales: liq.montoAdicionales,
            descuentos: liq.descuentos,
            totalNeto: liq.totalNeto,
            desglose: liq.manualData,
        })), modeloRecibo)
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
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        {d.periodo}
                                                        {(d.tipo === 'VACACIONES' || d.manualData?.esVacaciones || d.periodo.toLowerCase().includes('vacaciones')) && (
                                                            <span style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', padding: '0 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>VACACIONES</span>
                                                        )}
                                                        {d.tipo === 'FINAL' && (
                                                            <span style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '0 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>FINAL</span>
                                                        )}
                                                        {d.tipo === 'HORAS_EXTRAS_ADEUDADAS' && (
                                                            <span style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '0 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>HS. ADEUDADAS</span>
                                                        )}
                                                    </div>
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
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
                    <label style={{ display: 'grid', gap: '4px', minWidth: '210px' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', fontWeight: 600 }}>Modelo de recibo</span>
                        <select className="form-select" value={modeloRecibo} onChange={e => setModeloRecibo(e.target.value as ModeloRecibo)}>
                            {MODELOS_RECIBO.map(modelo => <option key={modelo.value} value={modelo.value}>{modelo.label}</option>)}
                        </select>
                    </label>
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
