'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import type { RangoFechas } from '../utils/dateUtils'
import type { calcularConsumoPedidos } from '@/lib/reportes/consumo-pedidos'
import type { calcularProductMix } from '@/lib/reportes/product-mix'
import type { ReportePedidosOnline } from '@/lib/reportes/pedidos-online'
import ProductMixTable from './ProductMixTable'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type Data = ReturnType<typeof calcularConsumoPedidos> & {
    productMix: ReturnType<typeof calcularProductMix>
    calidad: ReportePedidosOnline['calidad']
    porSaborElegido: ReportePedidosOnline['porSaborElegido']
    opciones: { origenes: string[]; modalidades: string[] }
    actualizado: string
}

const diaArgentina = (fecha: Date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(fecha)
const dinero = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const cantidad = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 3 })

export default function ConsumoPedidosSection({ rango, ubicacionId, origen, modalidad, revision, onOrigenChange, onModalidadChange }: {
    rango: RangoFechas; ubicacionId: string; origen: string; modalidad: string; revision: number
    onOrigenChange: (valor: string) => void; onModalidadChange: (valor: string) => void
}) {
    const [resultado, setResultado] = useState<{ clave: string; data: Data | null; error: string } | null>(null)
    const [modalidades, setModalidades] = useState<string[]>([])
    const [revisionRecetas, setRevisionRecetas] = useState(0)
    const [saborDetalle, setSaborDetalle] = useState('')
    const [vista, setVista] = useState<'mix' | 'indicadores' | 'insumos' | 'calidad'>('mix')
    const params = new URLSearchParams({ desde: diaArgentina(rango.desde), hasta: diaArgentina(rango.hasta),
        origen, modalidad, ubicacionId })
    const clave = `${params}:${revision}:${revisionRecetas}`
    const cargando = resultado?.clave !== clave
    const data = cargando ? null : resultado?.data

    useEffect(() => {
        const leerRevision = () => { try { return window.localStorage.getItem('recetas-elegidos-actualizadas') } catch { return null } }
        let ultima = leerRevision()
        const comprobar = () => {
            const actual = leerRevision()
            if (actual !== ultima) { ultima = actual; setRevisionRecetas(valor => valor + 1) }
        }
        window.addEventListener('focus', comprobar)
        window.addEventListener('storage', comprobar)
        return () => { window.removeEventListener('focus', comprobar); window.removeEventListener('storage', comprobar) }
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        fetch(`/api/reportes/consumo-pedidos?${params}`, { signal: controller.signal }).then(async respuesta => {
            const json = await respuesta.json()
            if (!respuesta.ok) throw new Error(json.error || 'No se pudo cargar el reporte.')
            return json as Data
        }).then(json => {
            if (!controller.signal.aborted) { setResultado({ clave, data: json, error: '' }); setModalidades(json.opciones.modalidades) }
        }).catch(error => {
            if (!controller.signal.aborted) setResultado({ clave, data: null, error: error instanceof Error ? error.message : 'No se pudo cargar el reporte.' })
        })
        return () => controller.abort()
        // params se deriva de los filtros incluidos en clave.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave])

    const tiposConCosto = data?.porTipo.filter(tipo => tipo.costoEstimado !== null) ?? []
    const topTipos = [...tiposConCosto].sort((a, b) => (b.costoEstimado ?? 0) - (a.costoEstimado ?? 0)).slice(0, 10)
    const topInsumos = data?.porInsumoIdentificado.slice(0, 10) ?? []
    const saborDetalleActivo = data?.porSaborCosto.some(item => item.codigo === saborDetalle)
        ? saborDetalle : data?.porSaborCosto[0]?.codigo ?? ''
    const chartOptions = { responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
        plugins: { legend: { display: false } } }

    return <div className="fade-in">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end', marginBottom: 12 }}>
            <div style={{ flex: '1 1 280px' }}><h2 style={{ margin: 0 }}>Pedidos e insumos</h2><small>Fecha Entrega · {diaArgentina(rango.desde)} al {diaArgentina(rango.hasta)} · recetas vigentes</small></div>
            <label>Origen<select className="form-select" value={origen} onChange={e => onOrigenChange(e.target.value)}>
                <option value="">Local + online</option><option value="Pedidos_comunes">Local</option><option value="Pedidos_online">Online</option>
            </select></label>
            <label>Modalidad<select className="form-select" value={modalidad} onChange={e => onModalidadChange(e.target.value)}>
                <option value="">Todas</option>{modalidades.map(x => <option key={x} value={x}>{x}</option>)}
            </select></label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRevisionRecetas(valor => valor + 1)}>Actualizar cálculo</button>
            <Link href="/reportes/pedidos-conjunto" className="btn btn-secondary btn-sm">Ver detalle de pedidos</Link>
        </div>
        <nav role="tablist" aria-label="Vistas de pedidos e insumos" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {([
                ['mix', 'Product Mix'], ['indicadores', 'Indicadores'],
                ['insumos', 'Insumos y sabores'], ['calidad', 'Datos pendientes'],
            ] as const).map(([claveVista, etiqueta]) => <button key={claveVista} type="button" role="tab"
                aria-selected={vista === claveVista}
                className={`btn btn-sm ${vista === claveVista ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setVista(claveVista)}>{etiqueta}</button>)}
        </nav>
        {cargando && <div className="empty-state"><div className="spinner" /><p>Calculando consumo de insumos...</p></div>}
        {!cargando && resultado?.error && <div className="card" style={{ padding: 20, color: 'var(--color-danger)' }}>{resultado.error}</div>}
        {data && <>
            {vista === 'mix' && <ProductMixTable mix={data.productMix} />}
            {vista === 'indicadores' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
                {[
                    ['Ingreso esperado', dinero(data.resumen.ingresoEsperado)],
                    ['Paquetes entregados', cantidad(data.resumen.paquetesVendidos)],
                    ['Consumo teórico valorado', dinero(data.resumen.costoEstimado)],
                    ['Margen bruto comparable', dinero(data.resumen.margenComparable)],
                ].map(([titulo, valor]) => <div className="card" style={{ padding: 18 }} key={titulo}>
                    <small>{titulo}</small><strong style={{ display: 'block', fontSize: 24, marginTop: 6 }}>{valor}</strong>
                </div>)}
            </div>}
            {vista === 'calidad' && <div className="card" style={{ padding: 20, marginBottom: 18 }}>
                <h3 style={{ marginTop: 0 }}>Cobertura del cálculo</h3>
                <p>{cantidad(data.resumen.paquetesValorados)} paquetes con receta y precio completo; {cantidad(data.resumen.paquetesSinCosto)} paquetes sin costo calculable. {data.calidad.sinPaquetes} pedidos entregados tienen Producto o Cantidad sin clasificar.</p>
                <p>Calidad del Sheet: {data.calidad.sinPrecio} filas sin precio válido, {data.calidad.duplicados} IDs duplicados y {data.calidad.conflictos} IDs con datos contradictorios en el período. {data.calidad.sinFechaEntrega} IDs sin Fecha Entrega válida quedan fuera de los períodos.</p>
                <p>Planchas personalizadas: {data.porSaborElegido.reduce((total, sabor) => total + sabor.planchas, 0).toLocaleString('es-AR')} con sabor identificado; {data.calidad.sinSaboresElegidos} pedidos sin detalle de sabores válido. Los pedidos se valoran cuando cada sabor tiene insumos cargados, junto con el empaque y los precios; revisá que las fichas incluyan todos los ingredientes.</p>
                <p>De {dinero(data.resumen.ingresoEsperado)} esperados, {dinero(data.resumen.ingresoConCosto)} corresponden a paquetes con costo calculable y {dinero(data.resumen.ingresoSinCosto)} no tienen costo comparable. El margen usa sólo paquetes con precio y costo calculables; el consumo incluye además paquetes entregados sin precio.</p>
                <p>Período anterior equivalente: {cantidad(data.resumen.paquetesAnteriores)} paquetes clasificables y {dinero(data.resumen.costoAnterior)} de consumo valorado con las mismas recetas y precios actuales.</p>
                <small>El costo usa la ficha técnica y el precio actual de cada insumo, incluida la merma configurada. Es una estimación de insumos asociados a los paquetes vendidos: no equivale a compras, stock consumido real ni dinero cobrado. En pedidos mixtos, el precio se atribuye por cantidad de sándwiches. Los importes históricos pueden cambiar si cambian las recetas o los precios.</small>
            </div>}
            {vista === 'indicadores' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 18 }}>
                <div className="card" style={{ padding: 20 }}><h3>Insumos con mayor costo identificable</h3><div style={{ height: 320 }}><Bar data={{ labels: topInsumos.map(x => x.nombre), datasets: [{ label: 'Costo identificable', data: topInsumos.map(x => x.costoEstimado), backgroundColor: '#ef9f32' }] }} options={chartOptions} /></div></div>
                <div className="card" style={{ padding: 20 }}><h3>Paquetes con mayor costo estimado</h3><div style={{ height: 320 }}><Bar data={{ labels: topTipos.map(x => `${x.nombre} · ${x.presentacion}`), datasets: [{ label: 'Costo estimado', data: topTipos.map(x => x.costoEstimado ?? 0), backgroundColor: '#7c3aed' }] }} options={chartOptions} /></div></div>
            </div>}
            {vista === 'insumos' && <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3>Consumo identificable por insumo</h3>
                <p>El total incluye paquetes completos y fichas de sabor válidas de paquetes aún pendientes. La columna pendiente informa consumo conocido, pero no se suma al costo completo ni al margen hasta completar el pedido.</p>
                <div style={{ maxHeight: 420, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo</th><th>Total identificable</th><th>Paquetes completos</th><th>Sabores pendientes</th><th>Unidad</th><th>Costo identificable</th></tr></thead><tbody>
                    {data.porInsumoIdentificado.map(x => <tr key={x.id}><td>{x.nombre}</td><td>{cantidad(x.cantidad)}</td><td>{cantidad(x.cantidadCompleta)}</td><td>{cantidad(x.cantidadPendiente)}</td><td>{x.unidad}</td><td>{dinero(x.costoEstimado)}</td></tr>)}
                </tbody></table></div>{!data.porInsumoIdentificado.length && <p>No hay insumos identificables en este período.</p>}
            </div>}
            {vista === 'calidad' && <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3>Personalizados: costo según los sabores elegidos</h3>
                <p><strong>Fichas de sabor ya cargadas:</strong> {cantidad(data.resumen.elegidos.planchasConCosto)} planchas con {dinero(data.resumen.elegidos.costoSaboresIdentificados)} de insumos identificados. Este desglose incluye sabores de pedidos cuyo empaque u otro sabor todavía falta; no se suma otra vez al total ni al margen.</p>
                <p><strong>Paquetes con costo completo:</strong> {cantidad(data.resumen.elegidos.paquetesValorados)} · {dinero(data.resumen.elegidos.costoEstimado)} de insumos y empaque. {cantidad(data.resumen.elegidos.paquetesSinCosto)} paquetes siguen pendientes.</p>
                {data.resumen.elegidos.faltantes.length > 0 && <><p>Faltantes para completar paquetes (un mismo pedido puede aparecer en varios motivos):</p><ul>{data.resumen.elegidos.faltantes.map(x => <li key={x.motivo}>{x.motivo}: {cantidad(x.paquetes)} paquetes afectados</li>)}</ul></>}
            </div>}
            {vista === 'insumos' && <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3>Planchas y costo por sabor</h3>
                <p>Las planchas salen de «Sabores» en Observaciones del Sheet. Una ficha con insumos y precios válidos muestra su costo aunque el paquete siga pendiente por otros sabores o empaque. El empaque sólo integra el costo completo del paquete.</p>
                <div style={{ maxHeight: 340, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Sabor</th><th>Planchas</th><th>Con costo</th><th>Costo de insumos</th></tr></thead><tbody>
                    {data.porSaborElegido.map(x => { const costo = data.porSaborCosto.find(item => item.codigo === x.codigo); return <tr key={x.codigo}><td>{x.nombre}</td><td>{cantidad(x.planchas)}</td><td>{cantidad(costo?.planchasValoradas ?? 0)}</td><td>{costo ? dinero(costo.costoEstimado) : 'Pendiente'}</td></tr> })}
                </tbody></table></div>{!data.porSaborElegido.length && <p>No hay sabores elegidos identificados para estos filtros.</p>}
            </div>}
            {vista === 'insumos' && <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3>Insumos aplicados por sabor</h3>
                <p>Elegí un sabor para ver el consumo de cada insumo según sus planchas y la cantidad vigente en su ficha. Incluye sabores válidos aunque el paquete esté pendiente.</p>
                <label>Sabor<select className="form-select" value={saborDetalleActivo} onChange={e => setSaborDetalle(e.target.value)}>
                    {data.porSaborCosto.map(item => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
                </select></label>
                <div style={{ maxHeight: 340, overflow: 'auto', marginTop: 12 }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th>Costo estimado</th></tr></thead><tbody>
                    {data.porSaborInsumo.filter(item => item.codigo === saborDetalleActivo).map(item => <tr key={item.insumoId}><td>{item.insumo}</td><td>{cantidad(item.cantidad)}</td><td>{item.unidad}</td><td>{dinero(item.costoEstimado)}</td></tr>)}
                </tbody></table></div>{!saborDetalleActivo && <p>No hay fichas de sabor valorables en este período.</p>}
            </div>}
            {vista === 'indicadores' && <div className="card" style={{ padding: 20 }}><h3>Paquetes y margen por tipo</h3>
                <p>El costo por paquete es el promedio de los que tienen ficha completa. El margen compara sólo los paquetes con precio y costo calculables. Las recetas y precios actuales se aplican también al período anterior.</p>
                <div style={{ maxHeight: 480, overflow: 'auto' }}><table className="table" style={{ minWidth: 1080, width: '100%' }}><thead><tr><th>Paquete</th><th>Vendidos</th><th>Con costo</th><th>Con precio</th><th>Ingreso atribuido</th><th>Costo promedio por paquete</th><th>Consumo estimado</th><th>Margen comparable</th><th>Período anterior</th></tr></thead><tbody>
                    {data.porTipo.map(x => <tr key={x.clave}><td>{x.nombre} · {x.presentacion}{x.motivo && x.motivo !== 'Completa' && <small style={{ display: 'block' }}>{x.motivo}</small>}</td><td>{cantidad(x.paquetes)}</td><td>{cantidad(x.paquetesConCosto)}</td><td>{cantidad(x.paquetesConPrecio)}</td><td>{dinero(x.ingresoAtribuido)}</td><td>{x.costoPorPaquete === null ? 'Pendiente' : dinero(x.costoPorPaquete)}</td><td>{x.costoEstimado === null ? 'Pendiente' : dinero(x.costoEstimado)}</td><td>{x.margenComparable === null ? 'Pendiente' : dinero(x.margenComparable)}</td><td>{cantidad(x.paquetesAnteriores)} paquetes</td></tr>)}
                </tbody></table></div>{!data.porTipo.length && <p>No hay paquetes clasificables en este período.</p>}
            </div>}
        </>}
    </div>
}
