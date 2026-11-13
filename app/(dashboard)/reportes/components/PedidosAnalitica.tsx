'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js'
import type { ReportePedidosOnline } from '@/lib/reportes/pedidos-online'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)
const diaArgentina = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const moneda = (n: number | null) => n === null ? 'Sin datos' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const variacion = (actual: number, anterior: number) => anterior ? `${((actual / anterior - 1) * 100).toFixed(1)}%` : 'Sin base anterior'

export default function PedidosAnalitica({ conjunto = false }: { conjunto?: boolean }) {
    const [desde, setDesde] = useState(() => diaArgentina(new Date(Date.now() - 29 * 86_400_000)))
    const [hasta, setHasta] = useState(() => diaArgentina(new Date()))
    const [fechaComparacion, setFechaComparacion] = useState(() => diaArgentina(new Date()))
    const [modalidad, setModalidad] = useState('')
    const [origen, setOrigen] = useState('')
    const [ubicacion, setUbicacion] = useState('')
    const [estado, setEstado] = useState('')
    const [buscar, setBuscar] = useState('')
    const [pagina, setPagina] = useState(1)
    const [revision, setRevision] = useState(0)
    const [resultado, setResultado] = useState<{ clave: string; data: ReportePedidosOnline | null; error: string } | null>(null)
    const [opciones, setOpciones] = useState({ origenes: [] as string[], modalidades: [] as string[], ubicaciones: [] as string[], estados: [] as string[] })
    const endpoint = conjunto ? 'pedidos-conjunto' : 'pedidos-online'
    const params = new URLSearchParams({ desde, hasta, fechaComparacion, origen, modalidad, ubicacion, estado, buscar, pagina: String(pagina) })
    const consulta = params.toString()
    const clave = `${consulta}:${revision}`
    const cargando = resultado?.clave !== clave
    const data = cargando ? null : resultado?.data
    useEffect(() => {
        const controller = new AbortController()
        fetch(`/api/reportes/${endpoint}?${consulta}`, { signal: controller.signal }).then(async res => {
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'No se pudo cargar el reporte.')
            return json as ReportePedidosOnline
        }).then(json => {
            if (!controller.signal.aborted) { setResultado({ clave, data: json, error: '' }); setOpciones(json.opciones) }
        }).catch(error => {
            if (!controller.signal.aborted) setResultado({ clave, data: null, error: error instanceof Error ? error.message : 'No se pudo cargar el reporte.' })
        })
        return () => controller.abort()
    }, [consulta, clave, endpoint])
    const reset = () => setPagina(1)
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    return <div className="fade-in" style={{ paddingBottom: 40 }}>
        <Link href="/reportes" className="btn btn-ghost btn-sm">← Reportes</Link>
        <h1 style={{ marginTop: 16 }}>{conjunto ? 'Pedidos de local y online' : 'Pedidos online'}</h1>
        <p style={{ color: 'var(--color-gray-600)' }}>{conjunto ? 'Análisis conjunto de Pedidos_comunes y Pedidos_online.' : 'Análisis de la hoja Pedidos_online.'} Los filtros y gráficos usan la columna Fecha Entrega.</p>
        <div className="card" style={{ padding: 20, margin: '20px 0', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end' }}>
            <label>Entrega desde<input className="form-input" type="date" value={desde} onChange={e => { setDesde(e.target.value); reset() }} /></label>
            <label>Entrega hasta<input className="form-input" type="date" value={hasta} onChange={e => { setHasta(e.target.value); setFechaComparacion(e.target.value); reset() }} /></label>
            <label>Comparar entrega del día<input className="form-input" type="date" value={fechaComparacion} onChange={e => setFechaComparacion(e.target.value)} /></label>
            {conjunto && <label>Origen<select className="form-select" value={origen} onChange={e => { setOrigen(e.target.value); reset() }}><option value="">Ambas hojas</option>{opciones.origenes.map(x => <option key={x} value={x}>{x === 'Pedidos_comunes' ? 'Local' : 'Online'}</option>)}</select></label>}
            <label>Modalidad<select className="form-select" value={modalidad} onChange={e => { setModalidad(e.target.value); reset() }}><option value="">Todas</option>{opciones.modalidades.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Ubicación<select className="form-select" value={ubicacion} onChange={e => { setUbicacion(e.target.value); reset() }}><option value="">Todas</option>{opciones.ubicaciones.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Estado<select className="form-select" value={estado} onChange={e => { setEstado(e.target.value); reset() }}><option value="">Todos</option>{opciones.estados.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Buscar ID, cliente o producto<input className="form-input" value={buscar} onChange={e => { setBuscar(e.target.value); reset() }} maxLength={100} /></label>
            <button className="btn btn-secondary" onClick={() => setRevision(x => x + 1)}>Actualizar</button>
            <a className="btn btn-secondary" href={`/api/reportes/${endpoint}?${new URLSearchParams({ desde, hasta, fechaComparacion, origen, modalidad, ubicacion, estado, buscar, formato: 'csv' })}`}>Descargar CSV</a>
        </div>
        {cargando ? <p role="status">Leyendo pedidos…</p> : resultado?.error ? <p role="alert" style={{ color: 'var(--color-danger)' }}>{resultado.error}</p> : data && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                {[
                    ['Ingreso esperado', moneda(data.resumen.ingresoEsperado), `${variacion(data.resumen.ingresoEsperado, data.resumen.anterior.ingresoEsperado)} frente al período anterior`],
                    ['Entregados', data.resumen.entregados.toLocaleString('es-AR'), `${variacion(data.resumen.entregados, data.resumen.anterior.pedidos)} frente al período anterior`],
                    ['Ticket promedio', moneda(data.resumen.ticketPromedio), `${data.resumen.conPrecio} entregados con precio válido`],
                    ['Paquetes vendidos', data.resumen.paquetesVendidos.toLocaleString('es-AR'), `${data.resumen.conPaquetes} entregados con cantidad verificable`],
                    ['Pendientes', data.resumen.pendientes.toLocaleString('es-AR'), `${moneda(data.resumen.ingresoPotencial)} potencial`],
                    ['Cancelados', data.resumen.cancelados.toLocaleString('es-AR'), 'Excluidos del ingreso esperado'],
                ].map(([titulo, valor, detalle]) => <div key={titulo} className="card" style={{ padding: 18 }}><div style={{ color: 'var(--color-gray-600)' }}>{titulo}</div><strong style={{ display: 'block', fontSize: 24, margin: '8px 0' }}>{valor}</strong><small>{detalle}</small></div>)}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-gray-600)', margin: '14px 0 22px' }}>Ingreso esperado = suma de Precio de pedidos con Estado «Entregado», sin IDs duplicados o contradictorios. Es una estimación de pedidos y no acredita cobros en Caja. El período anterior tiene la misma cantidad de días.</p>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18 }}>Comparación de paquetes</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    <div><span>{data.comparacionPaquetes.fecha}</span><strong style={{ display: 'block', fontSize: 28 }}>{data.comparacionPaquetes.actual.paquetes.toLocaleString('es-AR')} paquetes</strong><small>{data.comparacionPaquetes.actual.sinClasificar} pedidos sin paquetes calculables</small></div>
                    <div><span>Mismo día de la semana anterior · {data.comparacionPaquetes.fechaSemanaAnterior}</span><strong style={{ display: 'block', fontSize: 28 }}>{data.comparacionPaquetes.semanaAnterior.paquetes.toLocaleString('es-AR')} paquetes</strong><small>{variacion(data.comparacionPaquetes.actual.paquetes, data.comparacionPaquetes.semanaAnterior.paquetes)} de variación diaria · {data.comparacionPaquetes.semanaAnterior.sinClasificar} sin calcular</small></div>
                    <div><span>7 días hasta {data.comparacionPaquetes.fecha}</span><strong style={{ display: 'block', fontSize: 28 }}>{data.comparacionPaquetes.ultimos7.paquetes.toLocaleString('es-AR')} paquetes</strong><small>{variacion(data.comparacionPaquetes.ultimos7.paquetes, data.comparacionPaquetes.sietePrevios.paquetes)} frente a los 7 días anteriores ({data.comparacionPaquetes.sietePrevios.paquetes.toLocaleString('es-AR')}). Sin calcular: {data.comparacionPaquetes.ultimos7.sinClasificar} y {data.comparacionPaquetes.sietePrevios.sinClasificar}.</small></div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-gray-600)', marginTop: 12 }}>Se cuentan sólo pedidos con Estado «Entregado» y Producto y Cantidad concordantes. Todas las fechas de esta comparación provienen de «Fecha Entrega»; el día actual puede estar incompleto.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
                {conjunto && <div className="card" style={{ padding: 20 }}><h2 style={{ fontSize: 18 }}>Ingreso esperado por origen</h2><div style={{ height: 280 }}><Bar data={{ labels: data.porOrigen.map(x => x.nombre === 'Pedidos_comunes' ? 'Local' : 'Online'), datasets: [{ label: 'Ingreso esperado', data: data.porOrigen.map(x => x.importeEsperado), backgroundColor: '#818cf8' }] }} options={chartOptions} /></div></div>}
                <div className="card" style={{ padding: 20 }}><h2 style={{ fontSize: 18 }}>Ingreso esperado por fecha de entrega</h2><div style={{ height: 280 }}><Line data={{ labels: data.porDia.map(x => x.fecha), datasets: [{ label: 'Ingreso esperado', data: data.porDia.map(x => x.ingresoEsperado), borderColor: '#047857', tension: .2 }] }} options={chartOptions} /></div></div>
                <div className="card" style={{ padding: 20 }}><h2 style={{ fontSize: 18 }}>Paquetes por fecha de entrega</h2><div style={{ height: 280 }}><Line data={{ labels: data.porDia.map(x => x.fecha), datasets: [{ label: 'Paquetes vendidos', data: data.porDia.map(x => x.paquetes), borderColor: '#7c3aed', backgroundColor: '#7c3aed', tension: .2 }] }} options={chartOptions} /></div></div>
                <div className="card" style={{ padding: 20 }}><h2 style={{ fontSize: 18 }}>Últimos 7 días vs. semana anterior</h2><div style={{ height: 280 }}><Bar data={{ labels: data.comparacionPaquetes.serie7.map(x => x.fechaActual.slice(5)), datasets: [
                    { label: '7 días hasta la fecha elegida', data: data.comparacionPaquetes.serie7.map(x => x.actual), backgroundColor: '#7c3aed' },
                    { label: '7 días anteriores', data: data.comparacionPaquetes.serie7.map(x => x.anterior), backgroundColor: '#a5b4fc' },
                ] }} options={{ ...chartOptions, plugins: { legend: { display: true } } }} /></div></div>
                <div className="card" style={{ padding: 20 }}><h2 style={{ fontSize: 18 }}>Pedidos por modalidad</h2><div style={{ height: 280 }}><Bar data={{ labels: data.porModalidad.map(x => x.nombre), datasets: [{ label: 'Pedidos', data: data.porModalidad.map(x => x.pedidos), backgroundColor: '#60a5fa' }] }} options={chartOptions} /></div></div>
                <div className="card" style={{ padding: 20 }}><h2 style={{ fontSize: 18 }}>Ingreso esperado por ubicación</h2><div style={{ height: 280 }}><Bar data={{ labels: data.porUbicacion.map(x => x.nombre), datasets: [{ label: 'Ingreso esperado', data: data.porUbicacion.map(x => x.importeEsperado), backgroundColor: '#34d399' }] }} options={chartOptions} /></div></div>
                <div className="card" style={{ padding: 20 }}><h2 style={{ fontSize: 18 }}>Estados</h2><div style={{ height: 280 }}><Bar data={{ labels: data.porEstado.map(x => x.nombre), datasets: [{ label: 'Pedidos', data: data.porEstado.map(x => x.pedidos), backgroundColor: '#fbbf24' }] }} options={chartOptions} /></div></div>
            </div>
            <div className="card" style={{ padding: 20, marginTop: 20 }}>
                <h2 style={{ fontSize: 18 }}>Detalle de pedidos</h2>
                <p>{data.totalFilas.toLocaleString('es-AR')} IDs coinciden con los filtros. Página {data.pagina} de {Math.max(data.paginas, 1)}.</p>
                <div style={{ overflowX: 'auto' }}><table className="table" style={{ width: '100%', minWidth: 1150 }}><thead><tr>{conjunto && <th>Origen</th>}<th>Fecha Entrega</th><th>Registro</th><th>ID</th><th>Cliente</th><th>Producto</th><th>Cantidad</th><th>Paquetes</th><th>Modalidad</th><th>Ubicación</th><th>Estado</th><th>Pago</th><th>Precio</th><th>Contacto</th><th>Observaciones</th></tr></thead><tbody>
                    {data.registros.map(x => <tr key={`${x.origen}:${x.id}`}>{conjunto && <td>{x.origen === 'Pedidos_comunes' ? 'Local' : 'Online'}</td>}<td>{x.fechaEntrega}</td><td>{x.fecha}</td><td>{x.id}{x.duplicado || x.conflicto ? ' ⚠' : ''}</td><td>{[x.nombre, x.apellido].filter(Boolean).join(' ')}</td><td>{x.producto}</td><td>{x.cantidad}</td><td>{x.paquetes ?? '—'}</td><td>{x.modalidad}</td><td>{x.ubicacion}</td><td>{x.estado}</td><td>{x.pago}</td><td>{moneda(x.precio)}</td><td>{x.telefono}<br />{x.direccion}</td><td style={{ whiteSpace: 'pre-wrap' }}>{x.observaciones}</td></tr>)}
                </tbody></table></div>
                {data.totalFilas === 0 && <p>No hay pedidos para estos filtros.</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}><button className="btn btn-secondary" disabled={pagina <= 1} onClick={() => setPagina(x => x - 1)}>Anterior</button><button className="btn btn-secondary" disabled={pagina >= data.paginas} onClick={() => setPagina(x => x + 1)}>Siguiente</button></div>
            </div>
            <details style={{ marginTop: 18 }}><summary>Calidad de datos y desglose por pago</summary><p>{data.calidad.duplicados} filas duplicadas; {data.calidad.conflictos} IDs contradictorios; {data.calidad.sinFechaEntrega} IDs sin Fecha Entrega válida, excluidos de los filtros; {data.calidad.sinPrecio} pedidos sin precio válido; {data.calidad.sinPaquetes} pedidos entregados sin paquetes calculables en el período.</p><ul>{data.porPago.map(x => <li key={x.nombre}>{x.nombre}: {x.pedidos} pedidos · {moneda(x.importeEsperado)} esperado</li>)}</ul></details>
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-gray-600)' }}>Lectura del Sheet: {new Date(data.actualizado).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}. Se reutiliza hasta dos minutos. Los datos de cliente se muestran sólo a usuarios con permiso de Reportes.</p>
        </>}
    </div>
}
