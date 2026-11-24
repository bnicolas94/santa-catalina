'use client'

import { useState } from 'react'
import type { calcularProductMix } from '@/lib/reportes/product-mix'

type Mix = ReturnType<typeof calcularProductMix>
const cantidad = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 5 })
const dinero = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export default function ProductMixTable({ mix, ventasRapidas }: { mix: Mix; ventasRapidas: number }) {
    const [modo, setModo] = useState<'lista' | 'matriz'>('lista')
    const [seleccion, setSeleccion] = useState('')
    const filaActiva = mix.filas.find(fila => fila.clave === seleccion) ?? mix.filas[0]
    const totales = new Map(mix.totales.map(item => [item.id, item]))
    return <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Product Mix</h3>
        <p>Paquetes entregados y consumo teórico calculado con las fichas actuales. Los totales por insumo están al final.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 16 }}>
            <span><strong>{cantidad(mix.paquetes)}</strong> paquetes clasificados</span>
            <span><strong>{mix.filas.length}</strong> tipos de paquete</span>
            <span><strong>{cantidad(ventasRapidas)}</strong> ventas rápidas personalizadas incluidas</span>
            <span><strong>{mix.filasIncompletas}</strong> tipos con datos pendientes</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" className={`btn btn-sm ${modo === 'lista' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setModo('lista')}>Explorar productos</button>
            <button type="button" className={`btn btn-sm ${modo === 'matriz' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setModo('matriz')}>Matriz completa</button>
        </div>
        {modo === 'lista' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 18, marginBottom: 20 }}>
            <div style={{ maxHeight: 440, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}>
                <thead><tr><th>Producto vendido</th><th>Paquetes</th><th>Ingreso esperado</th></tr></thead>
                <tbody>{mix.filas.map(fila => <tr key={fila.clave} style={{ background: filaActiva?.clave === fila.clave ? '#fff7e8' : undefined }}>
                    <td><button type="button" onClick={() => setSeleccion(fila.clave)} aria-pressed={filaActiva?.clave === fila.clave}
                        style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', fontWeight: 700 }}>
                        {fila.nombre}{fila.presentacion ? ` x${fila.presentacion}` : ''}</button>
                        {fila.faltantes.length > 0 && <small style={{ display: 'block' }}>Datos pendientes</small>}
                    </td><td>{cantidad(fila.paquetes)}</td><td>{dinero(fila.ingresoAtribuido)}</td>
                </tr>)}</tbody>
            </table></div>
            <div className="card" style={{ padding: 16 }}>
                {filaActiva ? <><h4 style={{ marginTop: 0 }}>{filaActiva.nombre}{filaActiva.presentacion ? ` x${filaActiva.presentacion}` : ''}</h4>
                    <p>{cantidad(filaActiva.paquetes)} paquetes vendidos · {dinero(filaActiva.ingresoAtribuido)} de ingreso esperado</p>
                    {filaActiva.faltantes.length > 0 && <p>Falta completar: {filaActiva.faltantes.join('; ')}.</p>}
                    <div style={{ maxHeight: 290, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo utilizado</th><th>Cantidad</th><th>Costo identificado</th></tr></thead>
                        <tbody>{filaActiva.insumos.map(item => <tr key={item.id}><td>{item.nombre}</td><td>{cantidad(item.cantidad)} {item.unidad}</td><td>{item.costoIdentificado === null ? 'Sin precio' : dinero(item.costoIdentificado)}</td></tr>)}</tbody>
                    </table></div>
                    {!filaActiva.insumos.length && <p>No hay insumos calculables para este producto.</p>}
                </> : <p>No hay paquetes clasificables en este período.</p>}
            </div>
        </div>}
        {modo === 'matriz' && <div style={{ maxHeight: 520, overflow: 'auto' }}>
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
        </div>}
        <h4 style={{ marginTop: 22 }}>Total utilizado por insumo</h4>
        <div style={{ maxHeight: 300, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}>
            <thead><tr><th>Insumo</th><th>Cantidad teórica</th><th>Unidad</th><th>Costo identificable</th></tr></thead>
            <tbody>{mix.totales.map(insumo => <tr key={insumo.id}><td>{insumo.nombre}</td><td>{cantidad(insumo.cantidad)}</td><td>{insumo.unidad}</td>
                <td>{insumo.costoIdentificado === null ? 'Sin precio completo' : dinero(insumo.costoIdentificado)}</td></tr>)}</tbody>
        </table></div>
    </div>
}
