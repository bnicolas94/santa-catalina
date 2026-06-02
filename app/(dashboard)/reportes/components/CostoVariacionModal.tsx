'use client'

import React, { useState } from 'react'
import { formatCurrency, formatPercent, formatDelta } from '../utils/formatters'

interface SubItem {
    nombre: string
    montoActual: number
    montoAnterior: number
    diferencia: number
    variacionPct: number | null
}

interface DesgloseItem {
    nombre: string
    montoActual: number
    montoAnterior: number
    diferencia: number
    variacionPct: number | null
    participacion: number
    items?: SubItem[]
}

interface CostoVariacionModalProps {
    desgloseCostos: DesgloseItem[]
    costoTotalActual: number
    costoTotalAnterior: number
    onClose: () => void
}

function VariacionBadge({ variacionPct, montoActual }: { variacionPct: number | null; montoActual: number }) {
    if (variacionPct == null) {
        return montoActual > 0
            ? <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>▲ Nuevo</span>
            : <span style={{ color: 'var(--color-gray-400)' }}>—</span>
    }
    if (Math.abs(variacionPct) < 0.5) {
        return <span style={{ color: 'var(--color-gray-400)' }}>≈ 0%</span>
    }
    const isUp = variacionPct > 0
    return (
        <span style={{ color: isUp ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{variacionPct.toFixed(1).replace('.', ',')}%
        </span>
    )
}

function DiffCell({ diferencia }: { diferencia: number }) {
    const isPositive = diferencia > 0
    const isNeutral = Math.abs(diferencia) < 1
    const color = isNeutral ? 'var(--color-gray-400)' : isPositive ? 'var(--color-danger)' : 'var(--color-success)'
    return (
        <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)', color, fontWeight: 600 }}>
            {isNeutral ? '—' : `${isPositive ? '+' : ''}${formatCurrency(diferencia)}`}
        </td>
    )
}

export default function CostoVariacionModal({
    desgloseCostos,
    costoTotalActual,
    costoTotalAnterior,
    onClose
}: CostoVariacionModalProps) {
    const deltaTotal = formatDelta(costoTotalActual, costoTotalAnterior, { invertColor: true })
    const diferenciaTotalAbs = costoTotalActual - costoTotalAnterior
    const [expandedRow, setExpandedRow] = useState<string | null>(null)

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
                    width: '95%', maxWidth: '950px', maxHeight: '90vh',
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
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)', marginBottom: 'var(--space-3)', fontStyle: 'italic' }}>
                        💡 Hacé clic en una categoría para ver el detalle de la variación
                    </p>
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
                                    const isExpanded = expandedRow === item.nombre
                                    const hasItems = item.items && item.items.length > 0

                                    return (
                                        <React.Fragment key={i}>
                                            <tr
                                                onClick={() => hasItems && setExpandedRow(isExpanded ? null : item.nombre)}
                                                style={{
                                                    transition: 'background-color 0.2s',
                                                    cursor: hasItems ? 'pointer' : 'default',
                                                    backgroundColor: isExpanded ? 'var(--color-primary-50, #eff6ff)' : undefined
                                                }}
                                            >
                                                <td style={{ fontWeight: 600 }}>
                                                    {hasItems && (
                                                        <span style={{
                                                            display: 'inline-block', width: 16, marginRight: 4,
                                                            transition: 'transform 0.2s',
                                                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                            fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)'
                                                        }}>▶</span>
                                                    )}
                                                    {!hasItems && <span style={{ display: 'inline-block', width: 20 }} />}
                                                    {item.nombre}
                                                </td>
                                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)' }}>{formatCurrency(item.montoActual)}</td>
                                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)', color: 'var(--color-gray-500)' }}>{formatCurrency(item.montoAnterior)}</td>
                                                <DiffCell diferencia={item.diferencia} />
                                                <td style={{ textAlign: 'right' }}>
                                                    <VariacionBadge variacionPct={item.variacionPct} montoActual={item.montoActual} />
                                                </td>
                                                <td style={{ textAlign: 'right', color: 'var(--color-gray-500)' }}>{formatPercent(item.participacion)}</td>
                                            </tr>

                                            {/* Sub-items expandidos */}
                                            {isExpanded && hasItems && (
                                                <tr>
                                                    <td colSpan={6} style={{ padding: 0, borderTop: 'none' }}>
                                                        <div style={{
                                                            borderLeft: '3px solid var(--color-primary)',
                                                            backgroundColor: 'var(--color-gray-50)',
                                                            padding: 'var(--space-3) var(--space-4)',
                                                            animation: 'fadeIn 0.2s ease'
                                                        }}>
                                                            <div style={{
                                                                fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)',
                                                                fontWeight: 600, marginBottom: 'var(--space-2)',
                                                                textTransform: 'uppercase', letterSpacing: '0.05em'
                                                            }}>
                                                                Detalle de variación — {item.nombre}
                                                            </div>
                                                            <table className="table" style={{ fontSize: 'var(--text-xs)' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ backgroundColor: 'var(--color-gray-100)' }}>Ítem</th>
                                                                        <th style={{ textAlign: 'right', backgroundColor: 'var(--color-gray-100)' }}>Actual</th>
                                                                        <th style={{ textAlign: 'right', backgroundColor: 'var(--color-gray-100)' }}>Anterior</th>
                                                                        <th style={{ textAlign: 'right', backgroundColor: 'var(--color-gray-100)' }}>Diferencia</th>
                                                                        <th style={{ textAlign: 'right', backgroundColor: 'var(--color-gray-100)' }}>Var. %</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {item.items!.map((sub, j) => (
                                                                        <tr key={j}>
                                                                            <td>{sub.nombre}</td>
                                                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)' }}>{formatCurrency(sub.montoActual)}</td>
                                                                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-ui)', color: 'var(--color-gray-500)' }}>{formatCurrency(sub.montoAnterior)}</td>
                                                                            <DiffCell diferencia={sub.diferencia} />
                                                                            <td style={{ textAlign: 'right' }}>
                                                                                <VariacionBadge variacionPct={sub.variacionPct} montoActual={sub.montoActual} />
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: 'var(--color-gray-50)', fontWeight: 700, borderTop: '2px solid var(--color-gray-300)' }}>
                                    <td><span style={{ display: 'inline-block', width: 20 }} />TOTAL</td>
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
