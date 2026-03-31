// components/produccion/v2/modals/NewLotModal.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useProduccion } from '../ProduccionContext'

interface NewLotModalProps {
    initialData?: {
        productoId: string
        presentacionId: string
        rondas: string
        paquetesPersonales: string
    }
}

export const NewLotModal: React.FC<NewLotModalProps> = ({ initialData }) => {
    const { 
        productos, 
        ubicaciones, 
        coordinadores, 
        setShowModal, 
        setError, 
        setSuccess, 
        mutate,
        filterFecha
    } = useProduccion()

    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const [form, setForm] = useState({
        productoId: initialData?.productoId || '',
        presentacionId: initialData?.presentacionId || '',
        fechaProduccion: filterFecha || getLocalDateString(),
        rondas: initialData?.rondas || '1',
        paquetesPersonales: initialData?.paquetesPersonales || '',
        empleadosRonda: '1',
        coordinadorId: '',
        estado: 'en_produccion',
        ubicacionId: '',
    })

    useEffect(() => {
        if (!form.ubicacionId && ubicaciones.length > 0) {
            const def = ubicaciones.find(u => u.tipo === 'FABRICA') || ubicaciones[0]
            setForm(f => ({ ...f, ubicacionId: def.id }))
        }
    }, [ubicaciones])

    const productoSel = productos.find((p) => p.id === form.productoId)
    const rondasNum = parseInt(form.rondas) || 0
    const paquetesTotal = parseInt(form.paquetesPersonales) || 0
    const planchasTotal = productoSel ? paquetesTotal * productoSel.planchasPorPaquete : 0

    const handleProductoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value
        const prod = productos.find((p) => p.id === val)
        const paq = prod ? rondasNum * prod.paquetesPorRonda : 0
        const defaultPresentacionId = prod?.presentaciones?.[0]?.id || ''
        setForm({ ...form, productoId: val, presentacionId: defaultPresentacionId, paquetesPersonales: val ? String(paq) : '' })
    }

    const handleRondasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const r = e.target.value
        const rNum = parseInt(r) || 0
        const paq = productoSel ? rNum * productoSel.paquetesPorRonda : 0
        setForm({ ...form, rondas: r, paquetesPersonales: String(paq) })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch('/api/lotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productoId: form.productoId,
                    presentacionId: form.presentacionId,
                    fechaProduccion: form.fechaProduccion,
                    unidadesProducidas: paquetesTotal,
                    empleadosRonda: form.empleadosRonda,
                    coordinadorId: form.coordinadorId,
                    estado: form.estado,
                    ubicacionId: form.ubicacionId,
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }
            setSuccess(`Lote registrado ${form.estado === 'en_produccion' ? '(en producción)' : '(en stock)'}`)
            setShowModal(false)
            mutate()
        } catch (err: any) {
            setError(err.message)
        }
    }

    return (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>Registrar Nuevo Lote</h2>
                    <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Producto</label>
                            <select className="form-select" value={form.productoId} onChange={handleProductoChange} required>
                                <option value="">Seleccionar producto...</option>
                                {productos.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        [{p.codigoInterno}] {p.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        {productoSel && productoSel.presentaciones && productoSel.presentaciones.length > 1 && (
                            <div className="form-group">
                                <label className="form-label">Presentación</label>
                                <select 
                                    className="form-select" 
                                    value={form.presentacionId} 
                                    onChange={(e) => setForm({ ...form, presentacionId: e.target.value })}
                                    required
                                >
                                    {productoSel.presentaciones.map(p => (
                                        <option key={p.id} value={p.id}>x{p.cantidad} unidades</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">Fecha de producción</label>
                                <input type="date" className="form-input" value={form.fechaProduccion} onChange={(e) => setForm({ ...form, fechaProduccion: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cantidad de rondas</label>
                                <input type="number" className="form-input" value={form.rondas} onChange={handleRondasChange} required min="1" />
                            </div>
                        </div>

                        {productoSel && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{rondasNum}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Rondas</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <input type="number" value={form.paquetesPersonales} onChange={(e) => setForm({ ...form, paquetesPersonales: e.target.value })} 
                                        style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)', textAlign: 'center', width: '100%', background: 'transparent', border: 'none', borderBottom: '2px dashed var(--color-gray-300)' }} />
                                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Paquetes</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{planchasTotal}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Planchas</div>
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Sede / Ubicación</label>
                            <select className="form-select" value={form.ubicacionId} onChange={(e) => setForm({ ...form, ubicacionId: e.target.value })} required>
                                {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Coordinador</label>
                            <select className="form-select" value={form.coordinadorId} onChange={(e) => setForm({ ...form, coordinadorId: e.target.value })}>
                                <option value="">Sin asignar</option>
                                {coordinadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={!form.productoId}>Registrar Lote</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
