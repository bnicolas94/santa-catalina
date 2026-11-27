'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from '../ordenes.module.css'

type Orden = { numero: number; fechaLocal: string; proveedorNombre: string; proveedorContacto: string | null; proveedorTelefono: string | null; ubicacionNombre: string | null; observaciones: string | null; creadoPorNombre: string; detalles: Array<{ id: string; insumoNombre: string; cantidad: number; unidadMedida: string; observaciones: string | null }> }

export default function OrdenCompraDetallePage() {
    const { id } = useParams<{ id: string }>()
    const [orden, setOrden] = useState<Orden | null>(null)
    const [error, setError] = useState('')
    useEffect(() => { document.body.classList.add('printing-order'); return () => document.body.classList.remove('printing-order') }, [])
    useEffect(() => { fetch(`/api/compras/ordenes/${id}`, { cache: 'no-store' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'No se pudo cargar la orden'); setOrden(data) }).catch((err) => setError(err.message)) }, [id])
    if (error) return <div role="alert">{error}</div>
    if (!orden) return <div className="empty-state"><div className="spinner" /><p>Cargando orden...</p></div>
    return <div className={styles.printPage}>
        <div className={styles.printActions}><Link href="/compras/ordenes">← Órdenes de compra</Link><button className="btn btn-primary" onClick={() => window.print()}>Imprimir</button></div>
        <article className={styles.sheet}>
            <header className={styles.sheetHeader}><div><h1>Orden de compra</h1><strong>Santa Catalina</strong></div><div className={styles.sheetNumber}>#{orden.numero}<small>{orden.fechaLocal.split('-').reverse().join('/')}</small></div></header>
            <div className={styles.sheetMeta}><div><span>Proveedor</span><strong>{orden.proveedorNombre}</strong>{orden.proveedorContacto && <p>Contacto: {orden.proveedorContacto}</p>}{orden.proveedorTelefono && <p>Teléfono: {orden.proveedorTelefono}</p>}</div><div><span>Sede de destino</span><strong>{orden.ubicacionNombre || 'Sin especificar'}</strong><p>Preparada por: {orden.creadoPorNombre}</p></div></div>
            <table className={styles.table}><thead><tr><th>#</th><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th>Indicaciones</th></tr></thead><tbody>{orden.detalles.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.insumoNombre}</td><td>{new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(item.cantidad)}</td><td>{item.unidadMedida}</td><td>{item.observaciones || '—'}</td></tr>)}</tbody></table>
            {orden.observaciones && <section className={styles.sheetNotes}><strong>Observaciones</strong><p>{orden.observaciones}</p></section>}
            <div className={styles.signature}><span>Firma / conformidad</span><span>Fecha de compra</span></div>
        </article>
    </div>
}
