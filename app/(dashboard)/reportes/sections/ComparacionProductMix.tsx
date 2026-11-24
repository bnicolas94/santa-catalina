'use client'

import { useEffect, useState } from 'react'
import { diasRangoIso, rangoAnteriorIgualDuracion, type compararProductMix } from '@/lib/reportes/product-mix-comparacion'

type Comparacion = ReturnType<typeof compararProductMix>
type InsumoComparado = Comparacion['insumos'][number]
type Filtros = { desde: string; hasta: string; origen: string; modalidad: string; ubicacionId: string }
const numero = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 5 })
const dinero = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const diferencia = (valor: number, moneda = false) => `${valor > 0 ? '+' : ''}${moneda ? dinero(valor) : numero(valor)}`
const costo = (valor: number, completo: boolean) => !completo && valor === 0 ? 'Pendiente'
    : `${dinero(valor)}${completo ? '' : ' · parcial'}`

function TablaInsumos({ titulo, insumos }: { titulo: string; insumos: InsumoComparado[] }) {
    return <div style={{ marginTop: 18 }}>
        <h4>{titulo}</h4>
        {insumos.length ? <div style={{ maxHeight: 360, overflow: 'auto' }}><table className="table" style={{ minWidth: 880, width: '100%' }}>
            <thead><tr><th>Insumo</th><th>Consumo principal</th><th>Referencia</th><th>Diferencia</th><th>Costo principal</th><th>Referencia</th><th>Diferencia</th></tr></thead>
            <tbody>{insumos.map(item => <tr key={item.id}><td>{item.nombre}<small style={{ display: 'block' }}>{item.unidad}</small></td>
                <td>{numero(item.principal.cantidad)}</td><td>{numero(item.referencia.cantidad)}</td>
                <td><strong>{diferencia(item.diferencia.cantidad)}</strong></td>
                <td>{item.principal.costoIdentificado === null ? 'Sin precio' : dinero(item.principal.costoIdentificado)}</td>
                <td>{item.referencia.costoIdentificado === null ? 'Sin precio' : dinero(item.referencia.costoIdentificado)}</td>
                <td>{item.diferencia.costoIdentificado === null ? '—' : diferencia(item.diferencia.costoIdentificado, true)}</td>
            </tr>)}</tbody>
        </table></div> : <p>No hay consumo identificable para estos rangos.</p>}
    </div>
}

export default function ComparacionProductMix({ filtros }: { filtros: Filtros }) {
    const clave = JSON.stringify(filtros)
    const predeterminado = rangoAnteriorIgualDuracion(filtros.desde, filtros.hasta)
    const [borrador, setBorrador] = useState({ clave: '', desde: '', hasta: '' })
    const [aplicado, setAplicado] = useState({ clave: '', desde: '', hasta: '' })
    const [seleccion, setSeleccion] = useState('')
    const desdeB = borrador.clave === clave ? borrador.desde : predeterminado.desde
    const hastaB = borrador.clave === clave ? borrador.hasta : predeterminado.hasta
    const desdeAplicado = aplicado.clave === clave ? aplicado.desde : predeterminado.desde
    const hastaAplicado = aplicado.clave === clave ? aplicado.hasta : predeterminado.hasta
    const diasA = diasRangoIso(filtros.desde, filtros.hasta)
    const diasB = diasRangoIso(desdeAplicado, hastaAplicado)
    const rangoValido = /^\d{4}-\d{2}-\d{2}$/.test(desdeAplicado) && /^\d{4}-\d{2}-\d{2}$/.test(hastaAplicado)
        && diasB > 0 && diasB <= 366
    const params = new URLSearchParams({ ...filtros, desdeReferencia: desdeAplicado, hastaReferencia: hastaAplicado })
    const url = `/api/reportes/product-mix-comparacion?${params}`
    const [respuesta, setRespuesta] = useState<{ url: string; data: Comparacion | null; error: string } | null>(null)
    const cargando = rangoValido && respuesta?.url !== url
    const data = !cargando && rangoValido ? respuesta?.data : null
    const filaActiva = data?.filas.find(fila => fila.clave === seleccion) ?? data?.filas[0]

    useEffect(() => {
        if (!rangoValido) return
        const controller = new AbortController()
        fetch(url, { signal: controller.signal }).then(async res => {
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'No se pudo comparar Product Mix.')
            return json as { comparacion: Comparacion }
        }).then(json => {
            if (!controller.signal.aborted) setRespuesta({ url, data: json.comparacion, error: '' })
        }).catch(error => {
            if (!controller.signal.aborted) setRespuesta({ url, data: null,
                error: error instanceof Error ? error.message : 'No se pudo comparar Product Mix.' })
        })
        return () => controller.abort()
    }, [url, rangoValido])

    return <div>
        <p>El rango principal se elige arriba en Reportes. Elegí otro rango para comparar las ventas y el consumo según <strong>Fecha Entrega</strong>. Las diferencias son <strong>principal − referencia</strong>.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBottom: 14 }}>
            <div><small>Período principal</small><strong style={{ display: 'block' }}>{filtros.desde} al {filtros.hasta}</strong></div>
            <label>Referencia desde<input type="date" className="form-input" value={desdeB} onChange={e =>
                setBorrador({ clave, desde: e.target.value, hasta: hastaB })} /></label>
            <label>Referencia hasta<input type="date" className="form-input" value={hastaB} onChange={e =>
                setBorrador({ clave, desde: desdeB, hasta: e.target.value })} /></label>
            <button type="button" className="btn btn-primary btn-sm" onClick={() =>
                setAplicado({ clave, desde: desdeB, hasta: hastaB })}>Comparar</button>
        </div>
        {!rangoValido && <p role="alert">El rango de referencia debe tener entre 1 y 366 días.</p>}
        {diasA !== diasB && rangoValido && <p>Los rangos tienen distinta duración ({diasA} y {diasB} días). Las diferencias muestran totales, sin ajuste por día.</p>}
        {cargando && <div className="empty-state"><div className="spinner" /><p>Comparando períodos...</p></div>}
        {!cargando && respuesta?.url === url && respuesta.error && <p role="alert" style={{ color: 'var(--color-danger)' }}>{respuesta.error}</p>}
        {data && <>
            <p><strong>{numero(data.principal.paquetes)}</strong> paquetes en el principal · <strong>{numero(data.referencia.paquetes)}</strong> en la referencia · cambio <strong>{diferencia(data.diferencia.paquetes)}</strong>.</p>
            <p>Costo identificable: {costo(data.principal.costoIdentificado, data.principal.costoCompleto)} frente a {costo(data.referencia.costoIdentificado, data.referencia.costoCompleto)}. Diferencia: <strong>{data.diferencia.costoIdentificado === null ? 'No comparable por datos pendientes' : diferencia(data.diferencia.costoIdentificado, true)}</strong>.</p>
            {(data.principal.filasIncompletas > 0 || data.referencia.filasIncompletas > 0) &&
                <p>Hay tipos con fichas o precios pendientes ({data.principal.filasIncompletas} en el principal; {data.referencia.filasIncompletas} en la referencia). Sus cantidades identificadas se muestran; la diferencia de costo completo queda pendiente.</p>}
            <h4>Paquetes por tipo</h4>
            <div style={{ maxHeight: 420, overflow: 'auto' }}><table className="table" style={{ minWidth: 1200, width: '100%' }}>
                <thead><tr><th>Paquete</th><th>Vendidos principal</th><th>Referencia</th><th>Diferencia</th><th>Ingreso principal</th><th>Referencia</th><th>Dif. ingreso</th><th>Costo principal</th><th>Referencia</th><th>Dif. costo</th></tr></thead>
                <tbody>{data.filas.map(fila => <tr key={fila.clave} style={{ background: filaActiva?.clave === fila.clave ? '#fff7e8' : undefined }}>
                    <td><button type="button" onClick={() => setSeleccion(fila.clave)} aria-pressed={filaActiva?.clave === fila.clave}
                        style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', fontWeight: 700 }}>
                        {fila.nombre}{fila.presentacion ? ` x${fila.presentacion}` : ''}</button>
                        {(fila.principal.faltantes.length > 0 || fila.referencia.faltantes.length > 0) && <small style={{ display: 'block' }}>Datos pendientes</small>}
                    </td><td>{numero(fila.principal.paquetes)}</td><td>{numero(fila.referencia.paquetes)}</td>
                    <td><strong>{diferencia(fila.diferencia.paquetes)}</strong></td>
                    <td>{dinero(fila.principal.ingresoAtribuido)}</td><td>{dinero(fila.referencia.ingresoAtribuido)}</td>
                    <td>{diferencia(fila.diferencia.ingresoAtribuido, true)}</td>
                    <td>{costo(fila.principal.costoIdentificado, fila.principal.costoCompleto)}</td>
                    <td>{costo(fila.referencia.costoIdentificado, fila.referencia.costoCompleto)}</td>
                    <td>{fila.diferencia.costoIdentificado === null ? '—' : diferencia(fila.diferencia.costoIdentificado, true)}</td>
                </tr>)}</tbody>
            </table></div>
            {!data.filas.length && <p>No hay paquetes clasificables en estos rangos.</p>}
            {filaActiva && <>
                {(filaActiva.principal.faltantes.length > 0 || filaActiva.referencia.faltantes.length > 0) &&
                    <p>Datos pendientes de {filaActiva.nombre}: {[...new Set([...filaActiva.principal.faltantes, ...filaActiva.referencia.faltantes])].join('; ')}.</p>}
                <TablaInsumos titulo={`Insumos de ${filaActiva.nombre}${filaActiva.presentacion ? ` x${filaActiva.presentacion}` : ''}`} insumos={filaActiva.insumos} />
            </>}
            <TablaInsumos titulo="Total utilizado por insumo" insumos={data.insumos} />
            <small>El consumo y el costo usan las fichas y precios vigentes para ambos períodos. Son valores teóricos; no representan salidas reales de stock ni cobros confirmados.</small>
        </>}
    </div>
}
