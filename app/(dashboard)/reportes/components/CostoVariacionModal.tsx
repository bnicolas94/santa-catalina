'use client'

import React from 'react'
import { formatCurrency, formatPercent, formatDelta } from '../utils/formatters'

interface DesgloseItem {
    nombre: string
    montoActual: number
    montoAnterior: number
    diferencia: number
    variacionPct: number | null
    participacion: number
}

interface CostoVariacionModalProps {
    desgloseCostos: DesgloseItem[]
    costoTotalActual: number
    costoTotalAnterior: number
    onClose: () => void
}

export default function CostoVariacionModal({
    desgloseCostos,
    costoTotalActual,
    costoTotalAnterior,
    onClose
}: CostoVariacionModalProps) {
    const deltaTotal = formatDelta(costoTotalActual, costoTotalAnterior, { invertColor: true })
    const diferenciaTotalAbs = costoTotalActual - costoTotalAnterior

    return (
        <div
            className="fade-in"
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)'
            }}
        >
            <div
                className="card shadow-xl slide-up"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '95%', maxWidth: '900px', maxHeight: '85vh',
                    backgroundColor: 'white', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: 'var(--space-5) var(--space-6)',
                    borderBottom: '1px solid var(--color-gray-100)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>
                        📊 Análisis de Variación de Costos
                    </h2>
                    <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '24px', padding: '4px 8px' }}>&times;</button>
                </div>

                {/* KPIs resumen */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-5) var(--space-6)',
                    borderBottom: '1px solid var(--color-gray-100)',
                    backgroundColor: 'var(--color-gray-50)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>
                            Período Actual
                        </div>
                        <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-danger)' }}>
                            {formatCurrency(costoTotalActual)}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>
                            Período Anterior
                        </div>
                        <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-gray-600)' }}>
                            {formatCurrency(costoTotalAnterior)}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>
                            Variación Total
                        </div>
                        <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)', color: deltaTotal.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1)' }}>
                            <span>{deltaTotal.arrow}</span>
                            <span>{deltaTotal.text}</span>
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: diferenciaTotalAbs >= 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
                            {diferenciaTotalAbs >= 0 ? '+' : ''}{formatCurrency(diferenciaTotalAbs)}
                        </div>
                    </div>
                </div>

                {/* Tabla de desglose */}
                <div style={{ padding: 'var(--space-5) var(--space-6)', overflowY: 'auto', flex: 1 }}>
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Categoría</th>
                                    <th style={{ textAlign: 'right', position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Mes Actual</th>
                                    <th style={{ textAlign: 'right', position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Mes Anterior</th>
                                    <th style={{ textAlign: 'right', position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Diferencia</th>
                                    <th style={{ textAlign: 'right', position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Var. %</th>
                                    <th style={{ textAlign: 'right', position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>% Part.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {desgloseCostos.map((item, i) => {
                                    const isPositiveDiff = item.diferencia > 0
                                    const isNeutralDiff = Math.abs(item.diferencia) < 1
                                    // Para costos: subir = malo (rojo), bajar = bueno (verde)
                                    const diffColor = isNeutralDiff
                                        ? 'var(--color-gray-400)'
                                        : isPositiveDiff ? 'var(--color-danger)' : 'var(--color-success)'

                                    let varDisplay: React.ReactNode
                                    if (item.variacionPct == null) {
                                        varDisplay = item.montoActual > 0
                                            ? <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>▲ Nuevo</span>
                                            : <span style={{ color: 'var(--color-gray-400)' }}>—</span>
                                    } else if (Math.abs(item.variacionPct) < 0.5) {
                                        varDisplay = <span style={{ color: 'var(--color-gray-400)' }}>≈ 0%</span>
                                    } else {
                                        const isUp = item.variacionPct > 0
                                        varDisplay = (
                                            <span style={{
                                                color: isUp ? 'var(--color-danger)' : 'var(--color-success)',
                                                fontWeight: 600
                                            }}>
                                                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{item.variacionPct.toFixed(1).replace('.', ',')}%
                                            </span>
                                        )
                                    }

                                    return (
                                        <tr key={i} style={{ transition: 'background-color 0.2s' }}>
                                            <td style={{ fontWeight: 600 }}>{item.nombre}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)' }}>{formatCurrency(item.montoActual)}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)', color: 'var(--color-gray-500)' }}>{formatCurrency(item.montoAnterior)}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)', color: diffColor, fontWeight: 600 }}>
                                                {isNeutralDiff ? '—' : `${isPositiveDiff ? '+' : ''}${formatCurrency(item.diferencia)}`}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{varDisplay}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--color-gray-500)' }}>{formatPercent(item.participacion)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: 'var(--color-gray-50)', fontWeight: 700, borderTop: '2px solid var(--color-gray-300)' }}>
                                    <td>TOTAL</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)' }}>{formatCurrency(costoTotalActual)}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)', color: 'var(--color-gray-500)' }}>{formatCurrency(costoTotalAnterior)}</td>
                                    <td style={{
                                        textAlign: 'right', fontFamily: 'var(--font-ui)',
                                        color: diferenciaTotalAbs > 0 ? 'var(--color-danger)' : diferenciaTotalAbs < 0 ? 'var(--color-success)' : 'var(--color-gray-400)',
                                    }}>
                                        {diferenciaTotalAbs !== 0 ? `${diferenciaTotalAbs > 0 ? '+' : ''}${formatCurrency(diferenciaTotalAbs)}` : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', color: deltaTotal.color, fontWeight: 600 }}>
                                        {deltaTotal.arrow} {deltaTotal.text}
                                    </td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-gray-500)' }}>100%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: 'var(--space-4) var(--space-6)',
                    borderTop: '1px solid var(--color-gray-100)',
                    textAlign: 'right',
                    backgroundColor: 'var(--color-gray-50)'
                }}>
                    <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    )
}
