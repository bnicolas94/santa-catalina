'use client'

import { Fragment, useState } from 'react'
import { filtrarHistorialProveedor, type FacturaProveedor } from '@/lib/proveedores/historial'
import styles from './HistorialProveedor.module.css'

const fecha = (valor: string) => new Date(valor).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
const importe = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const estado: Record<string, string> = { pagado: 'Pagada', a_cuenta: 'Pago parcial', pendiente: 'Pendiente' }
const medio: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', mercado_pago: 'Mercado Pago', cheque: 'Cheque' }
const POR_PAGINA = 10

export default function HistorialProveedor({ facturas }: { facturas: FacturaProveedor[] }) {
    const [filtros, setFiltros] = useState({ busqueda: '', sede: '', estado: '', desde: '', hasta: '' })
    const [pagina, setPagina] = useState(1)
    const [abiertas, setAbiertas] = useState<string[]>([])
    const filtradas = filtrarHistorialProveedor(facturas, filtros)
    const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
    const paginaActual = Math.min(pagina, paginas)
    const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
    const sedes = [...new Map(facturas.map(factura => [factura.sede?.id || 'sin-sede', factura.sede?.nombre || 'Sin sede registrada'])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'es-AR'))

    function cambiarFiltro(campo: keyof typeof filtros, valor: string) {
        setFiltros(actual => ({ ...actual, [campo]: valor }))
        setPagina(1)
    }

    return (
        <section className="card">
            <div className={`card-header ${styles.encabezado}`}>
                <h3>Facturas y pagos</h3>
                <p className={styles.ayuda}>Consultá la sede de destino y abrí cada factura para ver sus ítems y pagos.</p>
            </div>
            <div className={`card-body ${styles.filtros}`}>
                <label className={styles.busqueda}>
                    <span className="form-label">Buscar</span>
                    <input className="form-input" placeholder="Factura, insumo, gasto o caja…" value={filtros.busqueda} onChange={e => cambiarFiltro('busqueda', e.target.value)} />
                </label>
                <label>
                    <span className="form-label">Sede de destino</span>
                    <select aria-label="Sede de destino" className="form-input" value={filtros.sede} onChange={e => cambiarFiltro('sede', e.target.value)}>
                        <option value="">Todas las sedes</option>
                        {sedes.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                    </select>
                </label>
                <label>
                    <span className="form-label">Estado de pago</span>
                    <select aria-label="Estado de pago" className="form-input" value={filtros.estado} onChange={e => cambiarFiltro('estado', e.target.value)}>
                        <option value="">Todos los estados</option>
                        {Object.entries(estado).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
                    </select>
                </label>
                <label>
                    <span className="form-label">Factura desde</span>
                    <input type="date" className="form-input" value={filtros.desde} onChange={e => cambiarFiltro('desde', e.target.value)} />
                </label>
                <label>
                    <span className="form-label">Factura hasta</span>
                    <input type="date" className="form-input" min={filtros.desde || undefined} value={filtros.hasta} onChange={e => cambiarFiltro('hasta', e.target.value)} />
                </label>
                {Object.values(filtros).some(Boolean) && <button className="btn btn-ghost" onClick={() => {
                    setFiltros({ busqueda: '', sede: '', estado: '', desde: '', hasta: '' }); setPagina(1)
                }}>Limpiar filtros</button>}
            </div>
            <div className="table-container">
                <table className={`table ${styles.tabla}`}>
                    <thead><tr><th>Fecha factura</th><th>Factura</th><th>Sede de destino</th><th>Total</th><th>Pagado / forma de pago</th><th>Saldo pendiente</th><th>Detalle</th></tr></thead>
                    <tbody>
                        {visibles.length === 0 && <tr><td colSpan={7} className="text-center p-4">{facturas.length ? 'No hay facturas con estos filtros.' : 'Sin facturas registradas.'}</td></tr>}
                        {visibles.map(factura => {
                            const abierta = abiertas.includes(factura.id)
                            const formas = [...new Set(factura.pagos.map(pago => `${medio[pago.medioPago] || pago.medioPago} · ${pago.caja}`))]
                            return (
                                <Fragment key={factura.id}>
                                    <tr>
                                        <td className={styles.moneda}>{fecha(factura.fecha)}</td>
                                        <td>
                                            <strong>{factura.numeroFactura || 'Sin número'}</strong>
                                            <div className={styles.ayuda}>{factura.items.length} {factura.items.length === 1 ? 'ítem' : 'ítems'}</div>
                                            <span className={`badge ${factura.estadoPago === 'pagado' ? 'badge-success' : factura.estadoPago === 'a_cuenta' ? 'badge-warning' : 'badge-danger'}`}>{estado[factura.estadoPago] || factura.estadoPago}</span>
                                        </td>
                                        <td>{factura.sede?.nombre || 'Sin sede registrada'}</td>
                                        <td className={styles.moneda}><strong>{importe(factura.total)}</strong></td>
                                        <td>
                                            <strong className={styles.moneda}>{importe(factura.pagado)}</strong>
                                            {formas.map(forma => <div className={styles.ayuda} key={forma}>{forma}</div>)}
                                            {factura.pagoSinDetalle && <div className={styles.aviso}>Pago sin detalle completo</div>}
                                            {!factura.pagos.length && !factura.pagoSinDetalle && <div className={styles.ayuda}>Sin pagos registrados</div>}
                                        </td>
                                        <td className={styles.moneda}><strong>{importe(factura.pendiente)}</strong></td>
                                        <td><button className="btn btn-ghost btn-sm" aria-expanded={abierta} aria-controls={`factura-${factura.id}`} aria-label={`${abierta ? 'Cerrar' : 'Ver'} detalle de factura ${factura.numeroFactura || 'sin número'} del ${fecha(factura.fecha)}`} onClick={() => setAbiertas(actual => abierta ? actual.filter(id => id !== factura.id) : [...actual, factura.id])}>{abierta ? 'Cerrar' : 'Ver detalle'}</button></td>
                                    </tr>
                                    {abierta && <tr id={`factura-${factura.id}`}><td colSpan={7} className={styles.detalle}>
                                        <div className={styles.encabezadoDetalle}>
                                            <strong>Factura {factura.numeroFactura || 'sin número'} · {fecha(factura.fecha)}</strong>
                                            <span className={styles.ayuda}>Ingreso: {fecha(factura.fechaIngreso)} · Destino: {factura.sede?.nombre || 'Sin sede registrada'}</span>
                                        </div>
                                        {factura.origen === 'historico' && <p className={styles.aviso}>Registro histórico: agrupado con los datos disponibles de factura, fecha y sede.</p>}
                                        {factura.observaciones && <p className={styles.observaciones}>{factura.observaciones}</p>}
                                        <div className={styles.columnasDetalle}>
                                            <div>
                                                <h4>Ítems de la factura</h4>
                                                <table className="table"><thead><tr><th>Concepto</th><th>Cantidad</th><th>Importe</th></tr></thead><tbody>
                                                    {factura.items.map(item => <tr key={item.id}>
                                                        <td>{item.descripcion}<div className={styles.ayuda}>{item.tipo === 'gasto' ? 'Gasto / servicio' : 'Insumo'}</div></td>
                                                        <td>{item.cantidad === null ? 'Sin especificar' : `${item.cantidad.toLocaleString('es-AR')} ${item.unidad || ''}`}</td>
                                                        <td className={styles.moneda}>{item.total === null ? 'Sin importe registrado' : importe(item.total)}</td>
                                                    </tr>)}
                                                </tbody></table>
                                            </div>
                                            <div>
                                                <h4>Historial de pagos</h4>
                                                {factura.pagos.length === 0 && <p className={styles.ayuda}>No hay movimientos de pago vinculados.</p>}
                                                {factura.pagos.map(pago => <div key={pago.id} className={styles.pago}>
                                                    <div className={styles.encabezadoDetalle}><strong>{importe(pago.monto)}</strong><span>{fecha(pago.fecha)}</span></div>
                                                    <div>{medio[pago.medioPago] || pago.medioPago} · {pago.caja}</div>
                                                    <div className={styles.ayuda}>Sede de la caja: {pago.sedeCaja || 'Sin sede registrada'}</div>
                                                </div>)}
                                                {factura.pagoSinDetalle && <p className={styles.aviso}>El importe pagado registrado no tiene un detalle completo de movimientos vinculados. No se puede confirmar el medio, la caja o la fecha de la parte faltante.</p>}
                                            </div>
                                        </div>
                                    </td></tr>}
                                </Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div className={`card-body ${styles.paginacion}`}>
                <span className={styles.ayuda}>{filtradas.length} {filtradas.length === 1 ? 'factura' : 'facturas'} · Página {paginaActual} de {paginas}</span>
                <div className={styles.botones}>
                    <button className="btn btn-ghost btn-sm" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</button>
                    <button className="btn btn-ghost btn-sm" disabled={paginaActual === paginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button>
                </div>
            </div>
        </section>
    )
}
