'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import HistorialProveedor from '@/components/proveedores/HistorialProveedor'
import type { FacturaProveedor } from '@/lib/proveedores/historial'
import styles from './page.module.css'

interface Insumo {
    id: string
    nombre: string
    unidadMedida: string
    stockActual: number
    precioUnitario: number
    familia: { nombre: string } | null
}

interface Proveedor {
    id: string
    nombre: string
    contacto: string | null
    telefono: string | null
    email: string | null
    direccion: string | null
    categoria: string | null
    activo: boolean
    insumos: Insumo[]
    facturas: FacturaProveedor[]
    resumen: {
        cantidadFacturas: number
        totalFacturado: number
        totalPagado: number
        totalPendiente: number
        sinDetallePago: number
    }
    _count: {
        insumos: number
        movimientosStock: number
        compras: number
    }
}

export default function ProveedorPerfilPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [proveedor, setProveedor] = useState<Proveedor | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [form, setForm] = useState({
        nombre: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: '',
        categoria: '',
        activo: true
    })

    const fetchProveedor = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch(`/api/proveedores/${id}`, { signal })
            if (!res.ok) throw new Error('No se pudo cargar el proveedor')
            const data: Proveedor = await res.json()
            if (signal?.aborted) return
            setProveedor(data)
            setForm({
                nombre: data.nombre,
                contacto: data.contacto || '',
                telefono: data.telefono || '',
                email: data.email || '',
                direccion: data.direccion || '',
                categoria: data.categoria || '',
                activo: data.activo
            })
        } catch (err: unknown) {
            if (!signal?.aborted) setError(err instanceof Error ? err.message : 'No se pudo cargar el proveedor')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [id])

    useEffect(() => {
        const controller = new AbortController()
        void fetchProveedor(controller.signal)
        return () => { controller.abort() }
    }, [fetchProveedor])

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault()
        try {
            const res = await fetch(`/api/proveedores/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            if (!res.ok) throw new Error('Error al actualizar')
            setIsEditing(false)
            fetchProveedor()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al actualizar')
        }
    }

    async function handleToggleStatus() {
        try {
            const res = await fetch(`/api/proveedores/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: !proveedor?.activo })
            })
            if (!res.ok) throw new Error('Error al cambiar estado')
            fetchProveedor()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al cambiar estado')
        }
    }

    if (loading) return <div className="p-8 text-center"><div className="spinner" /><p>Cargando perfil...</p></div>
    if (error) return <div className="p-8 text-center text-error">{error}</div>
    if (!proveedor) return <div className="p-8 text-center">Proveedor no encontrado</div>

    return (
        <div className="animate-in fade-in duration-500">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <Link href="/proveedores" className="btn btn-ghost btn-icon">←</Link>
                    <div>
                        <h1 style={{ marginBottom: 0 }}>{proveedor.nombre}</h1>
                        <span className={`badge ${proveedor.activo ? 'badge-success' : 'badge-neutral'}`}>
                            {proveedor.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-neutral" onClick={() => setIsEditing(!isEditing)}>
                        {isEditing ? 'Cancelar' : 'Editar Datos'}
                    </button>
                    <button 
                        className={`btn ${proveedor.activo ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={handleToggleStatus}
                    >
                        {proveedor.activo ? 'Desactivar' : 'Activar'}
                    </button>
                </div>
            </div>

            <div className={styles.resumen}>
                {[
                    { nombre: 'Total facturado', valor: proveedor.resumen.totalFacturado, dinero: true },
                    { nombre: 'Total pagado', valor: proveedor.resumen.totalPagado, dinero: true },
                    { nombre: 'Saldo pendiente', valor: proveedor.resumen.totalPendiente, dinero: true },
                    { nombre: 'Facturas / compras', valor: proveedor.resumen.cantidadFacturas, dinero: false },
                ].map(dato => <div key={dato.nombre} className="card"><div className="card-body">
                    <span className="text-muted small">{dato.nombre}</span>
                    <p className={styles.importe}>{dato.dinero ? dato.valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }) : dato.valor}</p>
                    <span className="text-muted small">Todo el historial</span>
                </div></div>)}
            </div>
            {proveedor.resumen.sinDetallePago > 0 && <p className={styles.aviso}>{proveedor.resumen.sinDetallePago} {proveedor.resumen.sinDetallePago === 1 ? 'factura tiene' : 'facturas tienen'} pagos sin detalle completo de medio, caja o fecha. Consultá el aviso en cada factura.</p>}
            <HistorialProveedor key={proveedor.id} facturas={proveedor.facturas} />

            <div className={styles.informacion}>
                {/* Datos de contacto */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    <div className="card">
                        <div className="card-header">
                            <h3>Información de Contacto</h3>
                        </div>
                        {isEditing ? (
                            <form onSubmit={handleUpdate} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="form-label">Nombre</label>
                                    <input className="form-input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Categoría</label>
                                    <select className="form-input" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                                        <option value="">Sin categoría</option>
                                        <option value="Materia Prima">Materia Prima</option>
                                        <option value="Servicios">Servicios</option>
                                        <option value="Mantenimiento">Mantenimiento</option>
                                        <option value="Embalaje">Embalaje</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contacto</label>
                                    <input className="form-input" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Teléfono</label>
                                    <input className="form-input" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                                </div>
                                <button type="submit" className="btn btn-primary w-full mt-2">Guardar Cambios</button>
                            </form>
                        ) : (
                            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <div>
                                    <label className="text-muted small uppercase" style={{ display: 'block' }}>Categoría</label>
                                    <span className="badge badge-neutral">{proveedor.categoria || 'Sin categoría'}</span>
                                </div>
                                <div>
                                    <label className="text-muted small uppercase" style={{ display: 'block' }}>Contacto</label>
                                    <p>{proveedor.contacto || '—'}</p>
                                </div>
                                <div>
                                    <label className="text-muted small uppercase" style={{ display: 'block' }}>Teléfono</label>
                                    <p>{proveedor.telefono || '—'}</p>
                                </div>
                                <div>
                                    <label className="text-muted small uppercase" style={{ display: 'block' }}>Email</label>
                                    <p>{proveedor.email || '—'}</p>
                                </div>
                                <div>
                                    <label className="text-muted small uppercase" style={{ display: 'block' }}>Dirección</label>
                                    <p>{proveedor.direccion || '—'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Insumos vinculados */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* Insumos Suministrados */}
                    <div className="card">
                        <div className="card-header">
                            <h3>Insumos que suministra</h3>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Insumo</th>
                                        <th>Familia</th>
                                        <th>Stock Actual</th>
                                        <th>Precio Unit.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {proveedor.insumos.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center p-4">No hay insumos vinculados</td></tr>
                                    ) : (
                                        proveedor.insumos.map(ins => (
                                            <tr key={ins.id}>
                                                <td style={{ fontWeight: 500 }}>{ins.nombre}</td>
                                                <td>{ins.familia?.nombre || '—'}</td>
                                                <td>{ins.stockActual} {ins.unidadMedida}</td>
                                                <td>${ins.precioUnitario.toLocaleString('es-AR')}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
