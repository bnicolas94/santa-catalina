'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import type { RangoFechas } from '../utils/dateUtils'
import type { calcularConsumoPedidos } from '@/lib/reportes/consumo-pedidos'
import type { ReportePedidosOnline } from '@/lib/reportes/pedidos-online'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type Data = ReturnType<typeof calcularConsumoPedidos> & {
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
    const params = new URLSearchParams({ desde: diaArgentina(rango.desde), hasta: diaArgentina(rango.hasta),
        origen, modalidad, ubicacionId })
    const clave = `${params}:${revision}`
    const cargando = resultado?.clave !== clave
    const data = cargando ? null : resultado?.data

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
    const topInsumos = data?.porInsumo.slice(0, 10) ?? []
    const chartOptions = { responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
        plugins: { legend: { display: false } } }

    return <div className="fade-in">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end', marginBottom: 18 }}>
            <div><h2 style={{ margin: 0 }}>Pedidos e insumos</h2><small>Ventas de local y online por Fecha Entrega, valoradas con las recetas vigentes.</small></div>
            <label>Origen<select className="form-select" value={origen} onChange={e => onOrigenChange(e.target.value)}>
                <option value="">Local + online</option><option value="Pedidos_comunes">Local</option><option value="Pedidos_online">Online</option>
            </select></label>
            <label>Modalidad<select className="form-select" value={modalidad} onChange={e => onModalidadChange(e.target.value)}>
                <option value="">Todas</option>{modalidades.map(x => <option key={x} value={x}>{x}</option>)}
            </select></label>
            <Link href="/reportes/pedidos-conjunto" className="btn btn-secondary btn-sm">Ver detalle de pedidos</Link>
        </div>
        {cargando && <div className="empty-state"><div className="spinner" /><p>Calculando consumo de insumos...</p></div>}
        {!cargando && resultado?.error && <div className="card" style={{ padding: 20, color: 'var(--color-danger)' }}>{resultado.error}</div>}
        {data && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
                {[
                    ['Ingreso esperado', dinero(data.resumen.ingresoEsperado)],
                    ['Paquetes entregados', cantidad(data.resumen.paquetesVendidos)],
                    ['Consumo teórico valorado', dinero(data.resumen.costoEstimado)],
                    ['Margen bruto comparable', dinero(data.resumen.margenComparable)],
                ].map(([titulo, valor]) => <div className="card" style={{ padding: 18 }} key={titulo}>
                    <small>{titulo}</small><strong style={{ display: 'block', fontSize: 24, marginTop: 6 }}>{valor}</strong>
                </div>)}
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 18 }}>
                <h3 style={{ marginTop: 0 }}>Cobertura del cálculo</h3>
                <p>{cantidad(data.resumen.paquetesValorados)} paquetes con receta y precio completo; {cantidad(data.resumen.paquetesSinCosto)} paquetes sin costo calculable. {data.calidad.sinPaquetes} pedidos entregados tienen Producto o Cantidad sin clasificar.</p>
                <p>Calidad del Sheet: {data.calidad.sinPrecio} filas sin precio válido, {data.calidad.duplicados} IDs duplicados y {data.calidad.conflictos} IDs con datos contradictorios en el período. {data.calidad.sinFechaEntrega} IDs sin Fecha Entrega válida quedan fuera de los períodos.</p>
                <p>Planchas elegidas: {data.porSaborElegido.reduce((total, sabor) => total + sabor.planchas, 0).toLocaleString('es-AR')} con sabor identificado; {data.calidad.sinSaboresElegidos} pedidos de Elegidos sin detalle de sabores válido. Los pedidos sólo se valoran cuando tienen base, todos sus sabores, empaque y precios completos.</p>
                <p>De {dinero(data.resumen.ingresoEsperado)} esperados, {dinero(data.resumen.ingresoConCosto)} corresponden a paquetes con costo calculable y {dinero(data.resumen.ingresoSinCosto)} no tienen costo comparable. El margen usa sólo paquetes con precio y costo calculables; el consumo incluye además paquetes entregados sin precio.</p>
                <p>Período anterior equivalente: {cantidad(data.resumen.paquetesAnteriores)} paquetes clasificables y {dinero(data.resumen.costoAnterior)} de consumo valorado con las mismas recetas y precios actuales.</p>
                <small>El costo usa la ficha técnica y el precio actual de cada insumo, incluida la merma configurada. Es una estimación de insumos asociados a los paquetes vendidos: no equivale a compras, stock consumido real ni dinero cobrado. En pedidos mixtos, el precio se atribuye por cantidad de sándwiches. Los importes históricos pueden cambiar si cambian las recetas o los precios.</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 18 }}>
                <div className="card" style={{ padding: 20 }}><h3>Insumos con mayor costo estimado</h3><div style={{ height: 320 }}><Bar data={{ labels: topInsumos.map(x => x.nombre), datasets: [{ label: 'Costo estimado', data: topInsumos.map(x => x.costoEstimado), backgroundColor: '#ef9f32' }] }} options={chartOptions} /></div></div>
                <div className="card" style={{ padding: 20 }}><h3>Paquetes con mayor costo estimado</h3><div style={{ height: 320 }}><Bar data={{ labels: topTipos.map(x => `${x.nombre} · ${x.presentacion}`), datasets: [{ label: 'Costo estimado', data: topTipos.map(x => x.costoEstimado ?? 0), backgroundColor: '#7c3aed' }] }} options={chartOptions} /></div></div>
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3>Consumo estimado por insumo</h3>
                <div style={{ maxHeight: 420, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th>Costo estimado</th></tr></thead><tbody>
                    {data.porInsumo.map(x => <tr key={x.id}><td>{x.nombre}</td><td>{cantidad(x.cantidad)}</td><td>{x.unidad}</td><td>{dinero(x.costoEstimado)}</td></tr>)}
                </tbody></table></div>{!data.porInsumo.length && <p>No hay insumos valorados en este período.</p>}
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3>Elegidos: costo según la mezcla real</h3>
                <p>{cantidad(data.resumen.elegidos.paquetesValorados)} paquetes valorados · {dinero(data.resumen.elegidos.costoEstimado)} de insumos estimados. {cantidad(data.resumen.elegidos.paquetesSinCosto)} paquetes siguen pendientes. Se suman base común, recetas de las planchas indicadas en el Sheet y empaque de cada presentación.</p>
                {data.resumen.elegidos.faltantes.length > 0 && <ul>{data.resumen.elegidos.faltantes.map(x => <li key={x.motivo}>{x.motivo}: {cantidad(x.paquetes)} paquetes</li>)}</ul>}
            </div>
            <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3>Planchas elegidas por sabor</h3>
                <p>El desglose sale de «Sabores» en Observaciones del Sheet. Se valida contra los sándwiches elegidos del pedido; las recetas del ERP permiten atribuir los insumos.</p>
                <div style={{ maxHeight: 340, overflow: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Sabor</th><th>Planchas</th><th>Sándwiches</th></tr></thead><tbody>
                    {data.porSaborElegido.map(x => <tr key={x.codigo}><td>{x.nombre}</td><td>{cantidad(x.planchas)}</td><td>{cantidad(x.sandwiches)}</td></tr>)}
                </tbody></table></div>{!data.porSaborElegido.length && <p>No hay sabores elegidos identificados para estos filtros.</p>}
            </div>
            <div className="card" style={{ padding: 20 }}><h3>Paquetes y margen por tipo</h3>
                <p>La comparación de costos usa los mismos precios y recetas actuales para ambos períodos de igual duración.</p>
                <div style={{ maxHeight: 480, overflow: 'auto' }}><table className="table" style={{ minWidth: 1050, width: '100%' }}><thead><tr><th>Paquete</th><th>Vendidos</th><th>Con precio</th><th>Ingreso atribuido</th><th>Costo por paquete</th><th>Consumo estimado</th><th>Margen comparable</th><th>Período anterior</th><th>Cobertura</th></tr></thead><tbody>
                    {data.porTipo.map(x => <tr key={x.clave}><td>{x.nombre} · {x.presentacion}</td><td>{cantidad(x.paquetes)}</td><td>{cantidad(x.paquetesConPrecio)}</td><td>{dinero(x.ingresoAtribuido)}</td><td>{x.costoPorPaquete === null ? '—' : dinero(x.costoPorPaquete)}</td><td>{x.costoEstimado === null ? '—' : dinero(x.costoEstimado)}</td><td>{x.margenComparable === null ? '—' : dinero(x.margenComparable)}</td><td>{cantidad(x.paquetesAnteriores)} paquetes</td><td>{x.motivo ?? 'Completa'}</td></tr>)}
                </tbody></table></div>{!data.porTipo.length && <p>No hay paquetes clasificables en este período.</p>}
            </div>
        </>}
    </div>
}
