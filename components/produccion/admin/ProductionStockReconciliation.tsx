'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'

import styles from './production-stock-reconciliation.module.css'

type Item = {
    productoId: string
    presentacionId: string
    codigoInterno: string
    producto: string
    presentacion: number
    ubicacionId: string
    ubicacion: string
    ubicacionTipo: string
    disponible: number
    producido: number
    vendidoLocal: number
    vendidoDelivery: number
    vendidoTotal: number
    balanceDia: number
}
type Resumen = {
    fecha: string
    items: Item[]
    totales: Pick<Item, 'disponible' | 'producido' | 'vendidoLocal' | 'vendidoDelivery' | 'vendidoTotal' | 'balanceDia'>
    calidad: { pedidosEntregados: number; pedidosSinClasificar: number; paquetesSinClasificar: number; errorVentas: string | null }
    sincronizacion: { activa: boolean; ultimaSincronizacion: string | null; error: string | null; pendientes: number; ventasActualizadasEn: string | null }
}

const fetcher = async (url: string) => {
    const respuesta = await fetch(url)
    const datos = await respuesta.json()
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo calcular el stock.')
    return datos as Resumen
}

function fechaCorta(fecha: string) {
    const [anio, mes, dia] = fecha.split('-')
    return `${dia}/${mes}/${anio}`
}

function fechaHora(fecha: string | null) {
    if (!fecha) return 'Sin sincronizaciones registradas'
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(fecha))
}

export function ProductionStockReconciliation({ date }: { date: string }) {
    const { data, error, isLoading, mutate } = useSWR<Resumen>(
        `/api/produccion/stock-resumen?fecha=${encodeURIComponent(date)}`,
        fetcher,
        { refreshInterval: 30_000, revalidateOnFocus: true },
    )
    const [location, setLocation] = useState('TODAS')
    const locations = useMemo(() => {
        const map = new Map<string, { id: string; nombre: string; tipo: string }>()
        for (const item of data?.items || []) map.set(item.ubicacionId, { id: item.ubicacionId, nombre: item.ubicacion, tipo: item.ubicacionTipo })
        return [...map.values()].sort((a, b) => (a.tipo === 'FABRICA' ? -1 : b.tipo === 'FABRICA' ? 1 : a.nombre.localeCompare(b.nombre)))
    }, [data?.items])
    const items = data?.items.filter(item => location === 'TODAS' || item.ubicacionId === location) || []
    const visibleTotals = items.reduce((total, item) => ({
        disponible: total.disponible + item.disponible,
        producido: total.producido + item.producido,
        vendidoLocal: total.vendidoLocal + item.vendidoLocal,
        vendidoDelivery: total.vendidoDelivery + item.vendidoDelivery,
        vendidoTotal: total.vendidoTotal + item.vendidoTotal,
        balanceDia: total.balanceDia + item.balanceDia,
    }), { disponible: 0, producido: 0, vendidoLocal: 0, vendidoDelivery: 0, vendidoTotal: 0, balanceDia: 0 })

    return <section className={styles.panel} aria-labelledby="stock-reconciliation-title">
        <div className={styles.header}>
            <div>
                <span className={styles.eyebrow}>Conciliación operativa</span>
                <h2 id="stock-reconciliation-title">Producción, ventas y stock disponible</h2>
                <p>Paquetes entregados del {fechaCorta(date)} comparados con la producción del día y el stock actual del ERP.</p>
            </div>
            <button type="button" className={styles.refresh} onClick={() => mutate()} disabled={isLoading}>↻ Actualizar</button>
        </div>

        {isLoading && <div className={styles.message}>Calculando producción, entregas y stock…</div>}
        {error && <div className={`${styles.message} ${styles.error}`}>{error.message}</div>}

        {data && <>
            <div className={styles.statusRow}>
                <span className={data.sincronizacion.activa ? styles.statusOk : styles.statusWarning}>
                    <i /> {data.sincronizacion.activa ? 'Descuento automático activo' : 'Descuento automático inactivo'}
                </span>
                <span>Último descuento: {fechaHora(data.sincronizacion.ultimaSincronizacion)}</span>
                <span>Lectura de ventas: {fechaHora(data.sincronizacion.ventasActualizadasEn)}</span>
            </div>

            {!data.sincronizacion.activa && <div className={styles.warning}>
                El stock disponible todavía no descuenta automáticamente las nuevas entregas del Sheet. Activá “Entregas y stock” antes de usarlo como saldo operativo.
            </div>}
            {(data.sincronizacion.error || data.calidad.errorVentas) && <div className={styles.warning}>
                {data.calidad.errorVentas || data.sincronizacion.error}
            </div>}
            {(data.sincronizacion.pendientes > 0 || data.calidad.pedidosSinClasificar > 0) && <div className={styles.warning}>
                Hay {data.sincronizacion.pendientes} entrega(s) pendientes de revisión y {data.calidad.pedidosSinClasificar} pedido(s) del día sin clasificación segura. No se ocultan: deben revisarse antes de considerar cerrado el stock.
            </div>}

            <div className={styles.filters}>
                <button type="button" className={location === 'TODAS' ? styles.selected : ''} onClick={() => setLocation('TODAS')}>Todas las sedes</button>
                {locations.map(item => <button type="button" key={item.id} className={location === item.id ? styles.selected : ''} onClick={() => setLocation(item.id)}>
                    {item.tipo === 'FABRICA' ? 'Fábrica' : item.nombre}
                </button>)}
            </div>

            <div className={styles.kpis}>
                <article><span>Stock disponible ERP</span><strong className={visibleTotals.disponible < 0 ? styles.negative : ''}>{visibleTotals.disponible}</strong><small>Paquetes registrados ahora</small></article>
                <article><span>Producido</span><strong>{visibleTotals.producido}</strong><small>Paquetes terminados del día</small></article>
                <article><span>Vendido local</span><strong>{visibleTotals.vendidoLocal}</strong><small>Entrega o retiro</small></article>
                <article><span>Vendido delivery</span><strong>{visibleTotals.vendidoDelivery}</strong><small>Pedidos entregados</small></article>
                <article className={styles.balance}><span>Balance del día</span><strong className={visibleTotals.balanceDia < 0 ? styles.negative : ''}>{visibleTotals.balanceDia > 0 ? '+' : ''}{visibleTotals.balanceDia}</strong><small>Producido menos vendido</small></article>
            </div>

            <div className={styles.tableWrap}>
                <table>
                    <thead><tr><th>Producto</th><th>Sede</th><th>Disponible</th><th>Producido</th><th>Local</th><th>Delivery</th><th>Total vendido</th><th>Balance día</th></tr></thead>
                    <tbody>
                        {items.map(item => <tr key={`${item.ubicacionId}-${item.presentacionId}`}>
                            <td><strong>{item.codigoInterno} x{item.presentacion}</strong><small>{item.producto}</small></td>
                            <td><strong>{item.ubicacion}</strong><small>{item.ubicacionTipo === 'FABRICA' ? 'Fábrica' : 'Local'}</small></td>
                            <td className={item.disponible < 0 ? styles.negative : styles.available}>{item.disponible}</td>
                            <td>{item.producido}</td><td>{item.vendidoLocal}</td><td>{item.vendidoDelivery}</td><td>{item.vendidoTotal}</td>
                            <td className={item.balanceDia < 0 ? styles.negative : styles.positive}>{item.balanceDia > 0 ? '+' : ''}{item.balanceDia}</td>
                        </tr>)}
                        {!items.length && <tr><td colSpan={8} className={styles.empty}>No hay producción, ventas ni stock registrado para esta selección.</td></tr>}
                    </tbody>
                </table>
            </div>
            <p className={styles.footnote}>“Disponible” es el saldo actual del ERP. Para validar el stock físico real, debe compararse con un conteo de cámara.</p>
        </>}
    </section>
}
