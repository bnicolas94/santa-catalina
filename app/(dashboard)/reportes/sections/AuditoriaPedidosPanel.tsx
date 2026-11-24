'use client'

import { useState } from 'react'
import type { calcularAuditoriaPedidos, ImpactoPendiente } from '@/lib/reportes/auditoria-pedidos'

type Auditoria = ReturnType<typeof calcularAuditoriaPedidos>
const etiquetas: Record<ImpactoPendiente, string> = {
    fuera_del_periodo: 'Sin Fecha Entrega', datos_ambiguos: 'ID ambiguo',
    sin_paquetes: 'Paquetes sin clasificar', sin_costo: 'Costo pendiente', sin_ingreso: 'Ingreso sin precio',
}
const separar = (valor: string | number) => {
    const texto = String(valor)
    const seguro = /^[\s\u0000-\u001f]*[=+\-@]/.test(texto) ? `'${texto}` : texto
    return `"${seguro.replace(/"/g, '""')}"`
}

export default function AuditoriaPedidosPanel({ auditoria }: { auditoria: Auditoria }) {
    const [impacto, setImpacto] = useState<ImpactoPendiente | ''>('')
    const [motivo, setMotivo] = useState('')
    const [buscar, setBuscar] = useState('')
    const [pagina, setPagina] = useState(1)
    const motivos = auditoria.motivos.filter(item => !impacto || item.impacto === impacto)
    const consulta = buscar.trim().toLocaleLowerCase('es-AR')
    const incidencias = auditoria.incidencias.filter(item => (!impacto || item.impacto === impacto)
        && (!motivo || JSON.stringify([item.impacto, item.motivo]) === motivo)
        && (!consulta || [item.id, item.producto, item.cantidad, item.ubicacion].some(valor =>
            valor.toLocaleLowerCase('es-AR').includes(consulta))))
    const paginas = Math.max(1, Math.ceil(incidencias.length / 10))
    const paginaActual = Math.min(pagina, paginas)
    const visibles = incidencias.slice((paginaActual - 1) * 10, paginaActual * 10)

    const descargar = () => {
        const cabecera = ['Origen', 'ID', 'Fila Sheet', 'Fecha registro', 'Fecha Entrega', 'Estado',
            'Sucursal', 'Producto', 'Cantidad', 'Impacto', 'Motivo']
        const filas = incidencias.map(item => [item.origen, item.id, item.fila, item.fechaRegistro,
            item.fechaEntrega, item.estado, item.ubicacion, item.producto, item.cantidad,
            etiquetas[item.impacto], item.motivo])
        const csv = `\uFEFF${[cabecera, ...filas].map(fila => fila.map(separar).join(';')).join('\r\n')}`
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
        const enlace = document.createElement('a')
        enlace.href = url
        enlace.download = 'pedidos-pendientes.csv'
        document.body.appendChild(enlace)
        enlace.click()
        enlace.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    return <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Pedidos para revisar</h3>
        <p><strong>{auditoria.pedidosUnicos.toLocaleString('es-AR')}</strong> IDs con al menos un pendiente. Un pedido puede tener varios motivos y aparecer más de una vez. Los IDs sin Fecha Entrega se muestran aparte porque no pueden asignarse al rango elegido.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBottom: 16 }}>
            <label>Tipo de pendiente<select className="form-select" value={impacto} onChange={e => {
                setImpacto(e.target.value as ImpactoPendiente | ''); setMotivo(''); setPagina(1)
            }}><option value="">Todos</option>{Object.entries(etiquetas).map(([clave, nombre]) =>
                <option key={clave} value={clave}>{nombre}</option>)}</select></label>
            <label style={{ flex: '1 1 260px' }}>Motivo<select className="form-select" value={motivo} onChange={e => {
                setMotivo(e.target.value); setPagina(1)
            }}><option value="">Todos los motivos</option>{motivos.map(item => {
                const clave = JSON.stringify([item.impacto, item.motivo])
                return <option key={clave} value={clave}>{item.motivo} · {item.pedidos.toLocaleString('es-AR')} IDs</option>
            })}</select></label>
            <label>Buscar ID o producto<input className="form-input" value={buscar} onChange={e => {
                setBuscar(e.target.value); setPagina(1)
            }} placeholder="ID, x8, x16..." /></label>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!incidencias.length} onClick={descargar}>Descargar CSV ({incidencias.length.toLocaleString('es-AR')})</button>
        </div>
        {incidencias.length ? <>
            <p style={{ marginBottom: 8 }}>{incidencias.length.toLocaleString('es-AR')} incidencias · página {paginaActual} de {paginas}</p>
            <div style={{ overflowX: 'auto' }}><table className="table" style={{ minWidth: 900, width: '100%' }}>
                <thead><tr><th>ID / origen</th><th>Fecha Entrega</th><th>Estado</th><th>Sucursal</th><th>Producto / cantidad</th><th>Motivo</th></tr></thead>
                <tbody>{visibles.map(item => <tr key={JSON.stringify([item.origen, item.id, item.impacto, item.motivo])}>
                    <td><strong>{item.id}</strong><small style={{ display: 'block' }}>{item.origen === 'Pedidos_comunes' ? 'Local' : 'Online'} · fila {item.fila}</small></td>
                    <td>{item.fechaEntrega || 'Sin fecha'}</td><td>{item.estado || 'Sin estado'}</td><td>{item.ubicacion || 'Sin sucursal'}</td>
                    <td><div style={{ maxWidth: 280, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.producto || 'Sin producto'}</div><small>Cantidad: {item.cantidad || 'sin dato'}</small></td>
                    <td><strong>{etiquetas[item.impacto]}</strong><small style={{ display: 'block' }}>{item.motivo}</small></td>
                </tr>)}</tbody>
            </table></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</button>
                <span>{paginaActual} / {paginas}</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={paginaActual >= paginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button>
            </div>
        </> : <p>No hay pedidos pendientes para estos filtros.</p>}
    </div>
}
