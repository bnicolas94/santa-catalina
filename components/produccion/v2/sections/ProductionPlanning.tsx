// components/produccion/v2/sections/ProductionPlanning.tsx
'use client'

import React from 'react'
import { PlanningData } from '../types'
import { useProduccion } from '../ProduccionContext'

interface ProductionPlanningProps {
    planning: PlanningData | null
    activeTurno: string
    setActiveTurno: (turno: string) => void
    filterDestino: 'TODOS' | 'FABRICA' | 'LOCAL'
    setFilterDestino: (destino: 'TODOS' | 'FABRICA' | 'LOCAL') => void
    onProduce: (pid: string, presid: string, rondas: number, total: number) => void
    onClearPlan: () => void
    onImportExcel: () => void
    onSaveManual: (pid: string, presid: string | null, val: string, turno: string) => void
    filterFecha: string
    onDescontarClick: () => void
    onRevertDescuentoClick: () => void
    isAdmin: boolean
}

export const ProductionPlanning: React.FC<ProductionPlanningProps> = ({
    planning,
    activeTurno,
    setActiveTurno,
    filterDestino,
    setFilterDestino,
    onProduce,
    onClearPlan,
    onImportExcel,
    onSaveManual,
    filterFecha,
    onDescontarClick,
    onRevertDescuentoClick,
    isAdmin
}) => {
    const { productos } = useProduccion()
    if (!planning) return null

    const isDiscounted = activeTurno !== 'Totales' && !!planning?.descuentosRealizados?.includes(activeTurno)
    const stockSource = filterDestino === 'LOCAL' ? 'local' : (filterDestino === 'FABRICA' ? 'fabrica' : 'ambos')

    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    // Helper to calculate planning items
    const getPlanningItems = () => {
        if (activeTurno === 'Totales') {
            const todosPids = new Set<string>()
            Object.values(planning?.necesidades || {}).forEach(t => {
                if (t) Object.keys(t).forEach(pid_presid => todosPids.add(pid_presid))
            })

            const manualesDetalleConsolidado: Record<string, { fabrica: number, local: number }> = {}
            Object.values(planning?.manualesDetalle || {}).forEach(turnoData => {
                Object.entries(turnoData).forEach(([key, det]) => {
                    if (!manualesDetalleConsolidado[key]) manualesDetalleConsolidado[key] = { fabrica: 0, local: 0 }
                    manualesDetalleConsolidado[key].fabrica += det.fabrica
                    manualesDetalleConsolidado[key].local += det.local
                })
            })

            const items: any[] = []
            todosPids.forEach(pid_presid => {
                const totalUnitsOriginal = Object.values(planning?.necesidades || {}).reduce((sum, t) => sum + (t?.[pid_presid] || 0), 0)
                const det = manualesDetalleConsolidado[pid_presid] || { fabrica: 0, local: 0 }
                const rutaUnitsTotal = Math.max(0, totalUnitsOriginal - (det.fabrica + det.local))
                
                const rutaUnits = filterDestino === 'LOCAL' ? 0 : rutaUnitsTotal
                const manualUnits = filterDestino === 'TODOS' ? (det.fabrica + det.local) : (filterDestino === 'LOCAL' ? det.local : det.fabrica)

                if (rutaUnits + manualUnits > 0 || filterDestino === 'TODOS') {
                    items.push({
                        key: pid_presid,
                        ruta: rutaUnits,
                        manual: manualUnits,
                        total: rutaUnits + manualUnits
                    })
                }
            })
            return items.sort((a,b) => (planning.infoProductos[a.key]?.codigoInterno || '').localeCompare(planning.infoProductos[b.key]?.codigoInterno || ''))
        } else {
            const necesidadesTurno = planning.necesidades[activeTurno] || {}
            const manualesTurno = planning.manualesDetalle?.[activeTurno] || {}
            
            return Object.entries(necesidadesTurno).map(([key, totalUnitsOriginal]) => {
                const manInfo = manualesTurno[key] || { fabrica: 0, local: 0 }
                const rutaUnitsRaw = Math.max(0, totalUnitsOriginal - (manInfo.fabrica + manInfo.local))
                const rutaUnits = filterDestino === 'LOCAL' ? 0 : rutaUnitsRaw
                const manualUnits = filterDestino === 'TODOS' ? (manInfo.fabrica + manInfo.local) : (filterDestino === 'LOCAL' ? manInfo.local : manInfo.fabrica)
                
                return {
                    key,
                    ruta: rutaUnits,
                    manual: manualUnits,
                    total: rutaUnits + manualUnits
                }
            }).sort((a,b) => (planning.infoProductos[a.key]?.codigoInterno || '').localeCompare(planning.infoProductos[b.key]?.codigoInterno || ''))
        }
    }

    const items = getPlanningItems()

    return (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>📅 Planificación — {filterFecha || getLocalDateString()}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-xs btn-ghost" onClick={onImportExcel} style={{ fontSize: '11px', border: '1px dashed var(--color-gray-300)' }}>📥 Importar Excel</button>
                        <button className="btn btn-xs btn-ghost" onClick={onClearPlan} style={{ fontSize: '11px', color: 'var(--color-error)' }}>🗑️ Limpiar</button>
                        
                        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-gray-100)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                            {['Mañana', 'Siesta', 'Tarde', 'Totales'].map(t => (
                                <button
                                    key={t}
                                    className={`btn btn-xs ${activeTurno === t ? (t === 'Totales' ? 'btn-success' : 'btn-primary') : 'btn-ghost'}`}
                                    onClick={() => setActiveTurno(t)}
                                    style={{ fontSize: '11px', padding: '4px 12px' }}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-gray-100)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                            {(['TODOS', 'FABRICA', 'LOCAL'] as const).map(d => (
                                <button
                                    key={d}
                                    className={`btn btn-xs ${filterDestino === d ? 'btn-neutral' : 'btn-ghost'}`}
                                    onClick={() => setFilterDestino(d)}
                                    style={{ fontSize: '10px', padding: '4px 8px' }}
                                >
                                    {d === 'TODOS' ? '🌐' : d === 'FABRICA' ? '🏭' : '🏪'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <table className="table table-planning">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style={{ textAlign: 'center' }}>H. Ruta</th>
                            {!isDiscounted && <th style={{ textAlign: 'center' }}>Express</th>}
                            <th style={{ textAlign: 'center' }}>Total</th>
                            {!isDiscounted && (
                                <>
                                    <th style={{ textAlign: 'center' }}>Stock</th>
                                    <th style={{ textAlign: 'center' }}>Proceso</th>
                                    <th style={{ textAlign: 'center' }}>Faltante</th>
                                    <th style={{ textAlign: 'center' }}>Final</th>
                                </>
                            )}
                            <th style={{ textAlign: 'right' }}>Sugerencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: 'var(--space-6)' }}>No hay requerimientos para este turno</td></tr>
                        ) : items.map((item) => {
                            const prodInfo = planning.infoProductos[item.key]
                            if (!prodInfo) return null
                            
                            const presSize = prodInfo?.presentacion?.cantidad || 48
                            const stockValue = (() => {
                                const fab = planning?.stockFabricacion?.[item.key] || 0
                                const loc = planning?.stockLocal?.[item.key] || 0
                                if (stockSource === 'fabrica') return fab
                                if (stockSource === 'local') return loc
                                return fab + loc
                            })()
                            const enProcUnits = prodInfo?.isPrimary ? (planning?.enProduccion?.[prodInfo.id] || 0) : 0
                            const faltanteUnits = Math.max(0, item.total - stockValue - enProcUnits)
                            const finalUnits = stockValue + enProcUnits - item.total
                            
                            const toPaq = (v: number) => (v / presSize).toFixed(1).replace('.0', '')
                            const unitsPerRonda = (prodInfo?.paquetesPorRonda || 14) * presSize
                            const rondasReal = Math.ceil(faltanteUnits / unitsPerRonda)

                            return (
                                <tr key={item.key}>
                                    <td>
                                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{prodInfo?.nombre} <span style={{ color: 'var(--color-primary)' }}>[x{presSize}]</span></div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{prodInfo?.codigoInterno}</div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{item.ruta > 0 ? `${toPaq(item.ruta)} p` : '—'}</td>
                                    {!isDiscounted && (
                                        <td style={{ textAlign: 'center' }}>
                                            <input 
                                                type="number" 
                                                defaultValue={toPaq(item.manual)}
                                                onBlur={(e) => onSaveManual(prodInfo.id, prodInfo.presentacion?.id, e.target.value, activeTurno)}
                                                style={{ width: '50px', textAlign: 'center', border: '1px solid var(--color-gray-200)', borderRadius: '4px' }}
                                            />
                                        </td>
                                    )}
                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{toPaq(item.total)} p</td>
                                    {!isDiscounted && (
                                        <>
                                            <td style={{ textAlign: 'center', color: stockValue < item.total ? 'var(--color-danger)' : 'var(--color-success)' }}>{toPaq(stockValue)} p</td>
                                            <td style={{ textAlign: 'center', color: '#F39C12' }}>{enProcUnits > 0 ? `${toPaq(enProcUnits)} p` : '—'}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                                {faltanteUnits > 0 ? <span style={{ color: 'var(--color-danger)' }}>{toPaq(faltanteUnits)} p</span> : '✅'}
                                            </td>
                                            <td style={{ textAlign: 'center', color: finalUnits < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{toPaq(finalUnits)} p</td>
                                        </>
                                    )}
                                    <td style={{ textAlign: 'right' }}>
                                        {faltanteUnits > 0 ? (
                                            <button className="btn btn-xs btn-primary" onClick={() => onProduce(prodInfo.id, prodInfo.presentacion?.id, rondasReal, faltanteUnits)}>
                                                {rondasReal} rondas
                                            </button>
                                        ) : '—'}
                                    </td>
                                </tr>
                            )
                        })}
                        {/* Fila Descontar y Agregar Producto Extra */}
                        {activeTurno !== 'Totales' && filterDestino !== 'LOCAL' && items.length > 0 && (
                            <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                <td colSpan={isDiscounted ? 2 : 2}>
                                    {!isDiscounted ? (
                                        <select
                                            className="form-select"
                                            style={{ height: '32px', fontSize: '12px' }}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                if (val) {
                                                    const [pid, presid] = val.split('_')
                                                    onSaveManual(pid, presid || null, '1', activeTurno)
                                                }
                                                e.target.value = ''
                                            }}
                                        >
                                            <option value="">+ Agregar producto extra al turno {activeTurno}...</option>
                                            {productos
                                                .filter(p => p.codigoInterno !== 'ELE')
                                                .flatMap(p =>
                                                    (p.presentaciones || []).map((pr: any) => {
                                                        const key = `${p.id}_${pr.id}`
                                                        if (planning?.necesidades[activeTurno]?.[key]) return null
                                                        return (
                                                            <option key={key} value={key}>
                                                                [{p.codigoInterno}] {p.nombre} (x{pr.cantidad})
                                                            </option>
                                                        )
                                                    })
                                                )}
                                        </select>
                                    ) : (
                                        <div style={{ padding: '8px', fontSize: '12px', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                                            Este turno ya fue procesado y su stock descontado.
                                        </div>
                                    )}
                                </td>
                                <td colSpan={isDiscounted ? 2 : 7} style={{ textAlign: 'right', verticalAlign: 'middle', paddingRight: 'var(--space-4)' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            className={`btn btn-sm ${isDiscounted ? 'btn-ghost' : 'btn-primary'}`}
                                            disabled={isDiscounted || !planning?.necesidades[activeTurno]}
                                            onClick={onDescontarClick}
                                            style={{ gap: 'var(--space-2)' }}
                                        >
                                            {isDiscounted
                                                ? '✅ Stock Descontado'
                                                : `📦 Descontar Stock: Turno ${activeTurno}`
                                            }
                                        </button>
                                        {isDiscounted && isAdmin && (
                                            <button
                                                className="btn btn-sm btn-error btn-outline"
                                                onClick={onRevertDescuentoClick}
                                                style={{ fontSize: '11px', height: '32px' }}
                                            >
                                                Revertir
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
