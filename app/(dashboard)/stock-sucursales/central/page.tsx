'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from '../stock-sucursales.module.css'

type Detalle = { id: string; insumoId: string; cantidadInformada: number | null; cantidadSolicitada: number | null; estadoReposicion: string | null; insumo: { nombre: string; unidadMedida: string }; historialEstados: { id: string; anterior: string | null; nuevo: string; createdAt: string; empleado: { nombre: string; apellido: string | null } | null }[] }
type Reporte = { id: string; fechaLocal: string; enviadoAt: string; ubicacionId: string; ubicacion: { nombre: string }; responsable: { nombre: string; apellido: string | null } | null; observaciones: string | null; detalles: Detalle[] }
type Stock = { ubicacionId: string; insumoId: string; cantidad: number }

export default function PedidosReposicionPage() {
    const [reportes, setReportes] = useState<Reporte[]>([])
    const [stocks, setStocks] = useState<Stock[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [soloPendientes, setSoloPendientes] = useState(true)
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [error, setError] = useState('')

    async function cargar() {
        setError('')
        const response = await fetch('/api/stock-sucursales/central', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los reportes')
        setReportes(payload.reportes)
        setStocks(payload.stocks)
    }
    useEffect(() => { cargar().catch((err) => setError(err.message)).finally(() => setLoading(false)) }, [])

    const visibles = useMemo(() => reportes.map((reporte) => ({ ...reporte, detalles: reporte.detalles.filter((detalle) => {
        const coincide = `${reporte.ubicacion.nombre} ${detalle.insumo.nombre}`.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es'))
        return coincide && (!soloPendientes || (detalle.cantidadSolicitada && detalle.cantidadSolicitada > 0 && detalle.estadoReposicion !== 'entregado'))
    }) })).filter((reporte) => reporte.detalles.length), [reportes, busqueda, soloPendientes])
    const pendientes = reportes.flatMap((reporte) => reporte.detalles).filter((detalle) => detalle.cantidadSolicitada && detalle.cantidadSolicitada > 0 && detalle.estadoReposicion !== 'entregado').length

    async function cambiarEstado(detalleId: string, estado: string) {
        setSavingId(detalleId); setError('')
        try {
            const response = await fetch('/api/stock-sucursales/central', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detalleId, estado }) })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar')
            await cargar()
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar') }
        finally { setSavingId(null) }
    }

    return <div className={styles.panel}>
        <header className={styles.header}><div><h1>Pedidos de reposición</h1><p>Reportes enviados por las sucursales</p></div><span className={styles.badge}>{pendientes} líneas abiertas</span></header>
        <p>La cantidad informada por el local y el stock registrado se muestran por separado. Cambiar el estado de un pedido no modifica el inventario.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.filters}><label>Buscar<input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Sucursal o insumo" /></label><label className={styles.check}><input type="checkbox" checked={soloPendientes} onChange={(event) => setSoloPendientes(event.target.checked)} /> Sólo solicitudes abiertas</label></div>
        {loading ? <p>Cargando…</p> : visibles.length === 0 ? <p>No hay solicitudes para mostrar.</p> : visibles.map((reporte) => <section className={styles.report} key={reporte.id}>
            <header><h2>{reporte.ubicacion.nombre}</h2><span>{reporte.fechaLocal} · {reporte.responsable ? `${reporte.responsable.nombre} ${reporte.responsable.apellido || ''}` : 'Sin responsable'}</span></header>
            {reporte.observaciones && <p>{reporte.observaciones}</p>}
            <div className={styles.list}>{reporte.detalles.map((detalle) => {
                const stock = stocks.find((item) => item.ubicacionId === reporte.ubicacionId && item.insumoId === detalle.insumoId)?.cantidad ?? 0
                return <div className={styles.centralItem} key={detalle.id}>
                    <strong>{detalle.insumo.nombre}</strong>
                    <span>Informa: {detalle.cantidadInformada ?? '—'} {detalle.insumo.unidadMedida}</span>
                    <span>Stock actual del sistema: {stock} {detalle.insumo.unidadMedida}</span>
                    <span>Solicita: {detalle.cantidadSolicitada ?? '—'} {detalle.insumo.unidadMedida}</span>
                    {detalle.cantidadSolicitada && detalle.cantidadSolicitada > 0 && <label>Estado<select value={detalle.estadoReposicion || 'pendiente'} disabled={savingId === detalle.id} onChange={(event) => cambiarEstado(detalle.id, event.target.value)}><option value="pendiente">Pendiente</option><option value="preparado">Preparado</option><option value="entregado">Entregado</option></select></label>}
                    {detalle.historialEstados.length > 0 && <details className={styles.events}><summary>Historial del pedido</summary><ul>{detalle.historialEstados.map((evento) => <li key={evento.id}>{new Date(evento.createdAt).toLocaleString('es-AR')}: {evento.anterior || 'sin estado'} → {evento.nuevo} · {evento.empleado?.nombre || 'Sistema'}</li>)}</ul></details>}
                </div>
            })}</div>
        </section>)}
    </div>
}
