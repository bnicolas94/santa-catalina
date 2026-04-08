// app/(dashboard)/produccion-v2/page.tsx
'use client'

import React, { useState } from 'react'
import { useProduccionData } from '@/components/produccion/hooks/useProduccionData'
import { ProduccionProvider } from '@/components/produccion/v2/ProduccionContext'
import { ProductionStats } from '@/components/produccion/v2/sections/ProductionStats'
import { ProductionPlanning } from '@/components/produccion/v2/sections/ProductionPlanning'
import { ProductionLotsTable } from '@/components/produccion/v2/sections/ProductionLotsTable'
import { ProductionStock } from '@/components/produccion/v2/sections/ProductionStock'
import { NewLotModal } from '@/components/produccion/v2/modals/NewLotModal'
import { CloseLotModal } from '@/components/produccion/v2/modals/CloseLotModal'
import { MermaModal } from '@/components/produccion/v2/modals/MermaModal'
import { TransferModal } from '@/components/produccion/v2/modals/TransferModal'
import { ImportModal } from '@/components/produccion/v2/modals/ImportModal'
import { MinStockModal } from '@/components/produccion/v2/modals/MinStockModal'
import { UbiModal } from '@/components/produccion/v2/modals/UbiModal'
import { DiscountModal } from '@/components/produccion/v2/modals/DiscountModal'
import { Lote } from '@/components/produccion/v2/types'
import styles from '@/components/produccion/v2/produccion.module.css'
import { useSession } from 'next-auth/react'

export default function ProduccionPageV2() {
    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const [filterFecha, setFilterFecha] = useState(getLocalDateString())
    const [filterEstado, setFilterEstado] = useState('')
    const [activeTurno, setActiveTurno] = useState('Mañana')
    const [filterDestino, setFilterDestino] = useState<'TODOS' | 'FABRICA' | 'LOCAL'>('TODOS')
    
    // Auth
    const { data: session } = useSession()
    const isAdmin = (session?.user as any)?.role === 'ADMIN'

    // UI States
    const [showModal, setShowModal] = useState(false)
    const [initialLotData, setInitialLotData] = useState<any>(null)
    const [showMermaModal, setShowMermaModal] = useState(false)
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [loteSeleccionado, setLoteSeleccionado] = useState<Lote | null>(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showDiscountModal, setShowDiscountModal] = useState(false)
    const [showMinStockModal, setShowMinStockModal] = useState(false)
    const [minStockForm, setMinStockForm] = useState<{ presentacionId: string, stockMinimo: string } | null>(null)
    const [showUbiModal, setShowUbiModal] = useState(false)

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const { data: swrData, isLoading: loading, mutate } = useProduccionData(filterFecha || getLocalDateString())

    const lotes = swrData?.lotes || []
    const productos = swrData?.productos || []
    const coordinadores = swrData?.coordinadores || []
    const ubicaciones = swrData?.ubicaciones || []
    const planning = swrData?.planning || null
    const stockProductos = swrData?.stockProductos || []

    const handleProduce = (pid: string, presid: string, rondas: number, total: number) => {
        setInitialLotData({
            productoId: pid,
            presentacionId: presid,
            rondas: String(rondas),
            paquetesPersonales: String(Math.ceil(total / 48) * 48) // simplification or exact packages
        })
        setShowModal(true)
    }

    const handleClearPlan = async () => {
        if (!confirm('¿Borrar todos los requerimientos manuales de hoy?')) return
        try {
            const res = await fetch(`/api/produccion/planificacion?fecha=${filterFecha}`, { method: 'DELETE' })
            if (res.ok) mutate()
            else setError('Error al borrar plan')
        } catch (err) { setError('Error de red') }
    }

    const handleSaveManual = async (productoId: string, presentacionId: string | null, value: string, turno: string) => {
        try {
            const res = await fetch('/api/produccion/planificacion/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: filterFecha,
                    turno,
                    productoId,
                    presentacionId,
                    cantidad: Math.round(parseFloat(value || '0') * 48), // simplified multiplier for now
                    destino: filterDestino === 'LOCAL' ? 'LOCAL' : 'FABRICA'
                })
            })
            if (res.ok) mutate()
        } catch (err) { console.error(err) }
    }

    const handleDeleteLote = async (lote: any) => {
        if (!confirm(`¿Eliminar lote ${lote.id}?`)) return
        try {
            const res = await fetch(`/api/lotes/${lote.id}`, { method: 'DELETE' })
            if (res.ok) {
                setSuccess('Lote eliminado')
                mutate()
            }
        } catch (err) { setError('Error al eliminar lote') }
    }

    const contextValue = {
        filterFecha,
        setFilterFecha,
        productos,
        ubicaciones,
        coordinadores,
        lotes,
        planning,
        loading,
        mutate,
        showModal,
        setShowModal,
        error,
        setError,
        success,
        setSuccess,
        stockProductos
    }

    if (loading && !swrData) {
        return <div className="loading-container"><div className="loader"></div><p>Iniciando Panel V2...</p></div>
    }

    return (
        <ProduccionProvider value={contextValue}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.titleGroup}>
                        <h1 className={styles.title}>🏭 Producción <span style={{ color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 400 }}>V2 Beta</span></h1>
                        <span className={styles.subtitle}>Gestión modular de lotes, planificación y stock de fábrica</span>
                    </div>
                    <div className={styles.controls}>
                        <input type="date" className="form-input" value={filterFecha} onChange={(e) => setFilterFecha(e.target.value)} style={{ width: '160px' }} />
                        <button className="btn btn-ghost" onClick={() => setShowTransferModal(true)}>🚚 Traslado</button>
                        <button className="btn btn-ghost" onClick={() => setShowMermaModal(true)}>⚠️ Merma</button>
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Lote</button>
                    </div>
                </div>

                {success && <div className="toast toast-success" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>{success}</div>}
                {error && <div className="toast toast-error" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>{error}</div>}

                <ProductionStats lotes={lotes} />

            <ProductionPlanning 
                planning={planning}
                activeTurno={activeTurno}
                setActiveTurno={setActiveTurno}
                filterDestino={filterDestino}
                setFilterDestino={setFilterDestino}
                onProduce={handleProduce}
                onClearPlan={handleClearPlan}
                onImportExcel={() => setShowImportModal(true)}
                onSaveManual={handleSaveManual}
                filterFecha={filterFecha}
                onDescontarClick={() => setShowDiscountModal(true)}
                onRevertDescuentoClick={async () => {
                    if (!confirm(`¿Estás seguro de que querés revertir el descuento de stock para el turno ${activeTurno}?`)) return
                    try {
                        const res = await fetch('/api/produccion/planificacion/descontar', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fecha: filterFecha || getLocalDateString(), turno: activeTurno })
                        })
                        if (res.ok) mutate()
                        else setError('Error al revertir descuento')
                    } catch (e: any) { setError(e.message) }
                }}
                isAdmin={isAdmin}
            />

            <ProductionStock 
                onOpenSedes={() => setShowUbiModal(true)}
                onOpenMoveStock={() => setShowTransferModal(true)}
                onOpenMerma={() => setShowMermaModal(true)}
                onOpenMinStock={(presentacionId, stockMinimo) => {
                    setMinStockForm({ presentacionId, stockMinimo })
                    setShowMinStockModal(true)
                }}
                onAdjustStock={(productoId, presentacionId, ubicacionId, qty) => {
                    setShowTransferModal(true) // TODO: Pasar initial values a TransferModal para simular ajuste rapido o dejar default
                }}
                onQuickTransfer={(productoId, presentacionId) => {
                    setShowTransferModal(true) // TODO: Pasar parameters
                }}
            />

            <div className={styles.sectionTitle}>
                <span>📋</span> Listado de Lotes
            </div>
            <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select className="form-select" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ width: '200px' }}>
                        <option value="">Todos los estados</option>
                        <option value="en_produccion">En Producción</option>
                        <option value="en_camara">En Cámara</option>
                        <option value="distribuido">Distribuido</option>
                    </select>
                </div>
            </div>

            <ProductionLotsTable 
                lotes={filterEstado ? lotes.filter(l => l.estado === filterEstado) : lotes}
                onEdit={(l) => setLoteSeleccionado(l)}
                onDelete={handleDeleteLote}
            />

            {showModal && (
                <NewLotModal 
                    initialData={initialLotData} 
                />
            )}
            {showMermaModal && <MermaModal onClose={() => setShowMermaModal(false)} />}
            {showTransferModal && <TransferModal onClose={() => setShowTransferModal(false)} />}
            {loteSeleccionado && (
                <CloseLotModal 
                    lote={loteSeleccionado} 
                    onClose={() => setLoteSeleccionado(null)} 
                />
            )}
            {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
            {showDiscountModal && <DiscountModal onClose={() => setShowDiscountModal(false)} activeTurno={activeTurno} />}
            {showMinStockModal && minStockForm && (
                <MinStockModal 
                    onClose={() => setShowMinStockModal(false)} 
                    initialPresentacionId={minStockForm.presentacionId} 
                    initialStockMinimo={minStockForm.stockMinimo} 
                />
            )}
            {showUbiModal && <UbiModal onClose={() => setShowUbiModal(false)} />}
            </div>
        </ProduccionProvider>
    )
}
