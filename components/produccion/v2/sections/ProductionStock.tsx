'use client'

import React from 'react'
import { useProduccion } from '../ProduccionContext'

interface ProductionStockProps {
    onOpenSedes: () => void
    onOpenMoveStock: () => void
    onOpenMerma: () => void
    onOpenMinStock: (presentacionId: string, minStock: string) => void
    onAdjustStock: (productoId: string, presentacionId: string, ubicacionId: string, qty: number) => void
    onQuickTransfer: (productoId: string, presentacionId: string) => void
}

export function ProductionStock({
    onOpenSedes,
    onOpenMoveStock,
    onOpenMerma,
    onOpenMinStock,
    onAdjustStock,
    onQuickTransfer
}: ProductionStockProps) {
    const { stockProductos, lotes, ubicaciones } = useProduccion()

    const enProcesoPorProducto = lotes
        .filter(l => l.estado === 'en_produccion')
        .reduce((acc, l) => {
            acc[l.producto.id] = (acc[l.producto.id] || 0) + l.unidadesProducidas
            return acc
        }, {} as Record<string, number>)

    return (
        <div className="card" style={{ marginBottom: 'var(--space-6)', overflow: 'visible' }}>
            <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>📦 Stock Producto Terminado</h2>
                        <div className="pulse-live" title="Actualizando en tiempo real cada 5s" />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-sm btn-ghost" onClick={onOpenSedes} title="Configurar Fábricas y Locales">⚙️ Sedes</button>
                        <button className="btn btn-sm btn-secondary" onClick={onOpenMoveStock}>Mover Stock</button>
                        <button className="btn btn-sm" style={{ backgroundColor: '#E74C3C', color: '#fff', fontWeight: 600 }} onClick={onOpenMerma}>⚠️ Merma</button>
                    </div>
                </div>
                {stockProductos.length === 0 ? (
                    <p style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: 'var(--space-4)' }}>No hay stock registrado. Registrá un lote para empezar.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                        {stockProductos
                            .filter(sp => sp.codigoInterno !== 'ELE')
                            .sort((a, b) => {
                                const codeOrder: Record<string, number> = { 'JQ': 1, 'CLA': 2, 'ESP': 3 }
                                const orderA = codeOrder[a.codigoInterno] || 99
                                const orderB = codeOrder[b.codigoInterno] || 99
                                if (orderA !== orderB) return orderA - orderB
                                return b.cantidadPresentacion - a.cantidadPresentacion
                            })
                            .map(sp => {
                                const isLowStock = sp.fabrica < sp.stockMinimo

                                return (
                                    <div key={`${sp.productoId}_${sp.presentacionId}`} style={{
                                        padding: 'var(--space-3)',
                                        borderRadius: 'var(--radius-md)',
                                        border: isLowStock ? '2px solid #E74C3C' : '1px solid var(--color-gray-200)',
                                        backgroundColor: isLowStock ? '#FFF5F5' : 'var(--color-gray-50)',
                                        boxShadow: isLowStock ? '0 0 10px rgba(231, 76, 60, 0.2)' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{sp.codigoInterno}</span>
                                                {isLowStock && <span title="¡Stock bajo en fábrica!" style={{ cursor: 'help' }}>⚠️</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 600 }}>[x{sp.cantidadPresentacion}] {sp.nombre}</span>
                                                <button
                                                    className="btn btn-xs btn-ghost"
                                                    style={{ padding: '2px', height: 'auto', minHeight: '0' }}
                                                    onClick={() => onOpenMinStock(sp.presentacionId, String(sp.stockMinimo))}
                                                    title="Configurar stock mínimo"
                                                >
                                                    ⚙️
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {Object.entries(sp.ubicaciones || {})
                                                .sort(([nameA], [nameB]) => {
                                                    const ubiA = ubicaciones.find(x => x.nombre === nameA)
                                                    const ubiB = ubicaciones.find(x => x.nombre === nameB)
                                                    if (ubiA?.tipo === 'FABRICA' && ubiB?.tipo !== 'FABRICA') return -1
                                                    if (ubiA?.tipo !== 'FABRICA' && ubiB?.tipo === 'FABRICA') return 1
                                                    return nameA.localeCompare(nameB)
                                                })
                                                .map(([ubiName, qty]: [string, any]) => {
                                                    const ubi = ubicaciones.find(x => x.nombre === ubiName)
                                                    const isFab = ubi?.tipo === 'FABRICA'
                                                    const color = isFab ? (isLowStock ? '#E74C3C' : '#2ECC71') : '#3498DB'

                                                    return (
                                                        <div key={ubiName}
                                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'var(--white)', border: '1px solid var(--color-gray-100)', borderRadius: '4px', cursor: 'pointer' }}
                                                            onClick={() => ubi && onAdjustStock(sp.productoId, sp.presentacionId, ubi.id, qty)}
                                                            title={`Ajustar stock en ${ubiName}`}
                                                        >
                                                            <span style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                                                {isFab ? '🏭' : '🏪'} {ubiName}
                                                            </span>
                                                            <span style={{ fontWeight: 700, color: color, fontSize: '14px' }}>
                                                                {qty} <span style={{ fontSize: '10px', opacity: 0.5 }}>✏️</span>
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            {Object.keys(sp.ubicaciones || {}).length === 0 && (
                                                <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', textAlign: 'center', fontStyle: 'italic' }}>Sin stock registrado</div>
                                            )}
                                        </div>
                                        {enProcesoPorProducto[sp.productoId] > 0 && (
                                            <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--color-gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '10px', color: '#F39C12', textTransform: 'uppercase', fontWeight: 700 }}>🚧 En camino:</span>
                                                <span style={{ fontSize: 'var(--text-sm)', color: '#F39C12', fontWeight: 700 }}>{enProcesoPorProducto[sp.productoId]} paq.</span>
                                            </div>
                                        )}
                                        {sp.stockMinimo > 0 && (
                                            <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '4px', color: isLowStock ? '#E74C3C' : 'var(--color-gray-400)', textTransform: 'uppercase', fontWeight: 600 }}>
                                                Mínimo: {sp.stockMinimo} paq.
                                            </div>
                                        )}
                                        <div style={{ marginTop: 'var(--space-3)' }}>
                                            <button className="btn btn-sm btn-ghost" style={{ width: '100%', fontSize: '10px', height: '24px' }}
                                                onClick={() => onQuickTransfer(sp.productoId, sp.presentacionId)}>
                                                🚚 Traslado rápido
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                )}
            </div>
        </div>
    )
}
