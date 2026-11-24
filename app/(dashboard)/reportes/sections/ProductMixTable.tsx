'use client'

import type { calcularProductMix } from '@/lib/reportes/product-mix'

type Mix = ReturnType<typeof calcularProductMix>
const cantidad = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 5 })
const dinero = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export default function ProductMixTable({ mix }: { mix: Mix }) {
    const totales = new Map(mix.totales.map(item => [item.id, item]))
    return <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Product Mix · vendido y consumo teórico</h3>
        <p>Cada fila parte de los paquetes entregados por Fecha Entrega. Las columnas aplican las fichas actuales y el total inferior suma el consumo identificable de cada insumo en el período. Una fila con faltantes muestra sólo los insumos que se pueden calcular.</p>
        <p><strong>{cantidad(mix.paquetes)} paquetes clasificados</strong> · {mix.filasIncompletas} tipos con fichas o precios pendientes.</p>
        <div style={{ maxHeight: 520, overflow: 'auto' }}>
            <table className="table" style={{ width: 'max-content', minWidth: '100%' }}>
                <thead><tr><th style={{ position: 'sticky', top: 0, left: 0, zIndex: 2, background: '#f8f9fa', minWidth: 210 }}>Producto</th><th style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>Vendidos</th><th style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>Ingreso esperado</th>
                    {mix.totales.map(insumo => <th key={insumo.id} style={{ position: 'sticky', top: 0, background: '#f8f9fa', minWidth: 120 }}>{insumo.nombre}<small style={{ display: 'block' }}>{insumo.unidad}</small></th>)}
                </tr></thead>
                <tbody>{mix.filas.map(fila => {
                    const insumos = new Map(fila.insumos.map(item => [item.id, item.cantidad]))
                    return <tr key={fila.clave}><td style={{ position: 'sticky', left: 0, background: '#fff' }}><strong>{fila.nombre}{fila.presentacion ? ` x${fila.presentacion}` : ''}</strong>
                        {fila.faltantes.length > 0 && <small style={{ display: 'block' }}>Pendiente: {fila.faltantes.join('; ')}</small>}
                    </td><td>{cantidad(fila.paquetes)}</td><td>{dinero(fila.ingresoAtribuido)}</td>
                        {mix.totales.map(insumo => <td key={insumo.id}>{insumos.has(insumo.id) ? cantidad(insumos.get(insumo.id)!) : '—'}</td>)}
                    </tr>
                })}</tbody>
                <tfoot><tr style={{ fontWeight: 700, background: '#f4f0e9' }}><td style={{ position: 'sticky', left: 0, background: '#f4f0e9' }}>Total utilizado</td>
                    <td>{cantidad(mix.paquetes)}</td><td>{dinero(mix.filas.reduce((total, fila) => total + fila.ingresoAtribuido, 0))}</td>
                    {mix.totales.map(insumo => <td key={insumo.id}>{cantidad(totales.get(insumo.id)?.cantidad ?? 0)}</td>)}
                </tr></tfoot>
            </table>
        </div>
        {!mix.filas.length && <p>No hay paquetes clasificables en este período.</p>}
        <h4 style={{ marginTop: 22 }}>Total utilizado por insumo</h4>
        <div style={{ maxHeight: 300, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}>
            <thead><tr><th>Insumo</th><th>Cantidad teórica</th><th>Unidad</th><th>Costo identificable</th></tr></thead>
            <tbody>{mix.totales.map(insumo => <tr key={insumo.id}><td>{insumo.nombre}</td><td>{cantidad(insumo.cantidad)}</td><td>{insumo.unidad}</td>
                <td>{insumo.costoIdentificado === null ? 'Sin precio completo' : dinero(insumo.costoIdentificado)}</td></tr>)}</tbody>
        </table></div>
    </div>
}
