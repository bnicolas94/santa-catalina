'use client'

import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import type { RangoFechas } from '../utils/dateUtils'
import type { calcularCostosProduccion } from '@/lib/reportes/costos-produccion'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type Data = ReturnType<typeof calcularCostosProduccion>
const diaArgentina = (fecha: Date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(fecha)
const numero = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 6 })
const dinero = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export default function CostosProduccionSection({ rango, ubicacionId, revision }: {
    rango: RangoFechas; ubicacionId: string; revision: number
}) {
    const [resultado, setResultado] = useState<{ clave: string; data: Data | null; error: string } | null>(null)
    const [vista, setVista] = useState<'productos' | 'insumos' | 'evolucion' | 'pendientes'>('productos')
    const [productoElegido, setProductoElegido] = useState('')
    const params = new URLSearchParams({ desde: diaArgentina(rango.desde), hasta: diaArgentina(rango.hasta), ubicacionId })
    const clave = `${params}:${revision}`
    const cargando = resultado?.clave !== clave
    const data = cargando ? null : resultado?.data

    useEffect(() => {
        const controller = new AbortController()
        fetch(`/api/reportes/costos-produccion?${params}`, { signal: controller.signal }).then(async respuesta => {
            const json = await respuesta.json()
            if (!respuesta.ok) throw new Error(json.error || 'No se pudo cargar el reporte.')
            return json as Data
        }).then(json => {
            if (!controller.signal.aborted) setResultado({ clave, data: json, error: '' })
        }).catch(error => {
            if (!controller.signal.aborted) setResultado({ clave, data: null,
                error: error instanceof Error ? error.message : 'No se pudo cargar el reporte.' })
        })
        return () => controller.abort()
        // params se deriva por completo de clave.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave])

    const seleccionado = data?.porProducto.find(item => item.clave === productoElegido) ?? data?.porProducto[0]

    return <div className="fade-in">
        <h2 style={{ marginBottom: 8 }}>Costos de producción</h2>
        <p style={{ marginTop: 0 }}>Paquetes producidos en fábrica según la fecha de producción del lote. El consumo es teórico: aplica las fichas, mermas y precios actuales a los paquetes producidos, incluidos los rechazados.</p>
        {cargando && <p>Cargando costos de producción…</p>}
        {!cargando && resultado?.error && <div className="card" role="alert" style={{ padding: 20, color: 'var(--color-danger)' }}>{resultado.error}</div>}
        {data && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
                {[
                    ['Paquetes producidos', numero(data.resumen.paquetes)],
                    ['Paquetes buenos', numero(data.resumen.buenos)],
                    ['Rechazados', numero(data.resumen.rechazados)],
                    ['Costo teórico identificado', dinero(data.resumen.costoIdentificado)],
                ].map(([titulo, valor]) => <div className="card" key={titulo} style={{ padding: 18 }}><small>{titulo}</small><strong style={{ display: 'block', fontSize: 23, marginTop: 6 }}>{valor}</strong></div>)}
            </div>
            <div className="card" style={{ padding: 18, marginBottom: 18 }}>
                <strong>Cobertura:</strong> {numero(data.resumen.lotes)} lotes confirmados; {numero(data.resumen.lotesPendientes)} con datos o precios pendientes. {data.resumen.lotesExcluidos > 0 && `${numero(data.resumen.lotesExcluidos)} lotes en producción o anulados excluidos.`}
                {!data.resumen.costoCompleto && <p style={{ marginBottom: 0 }}>El importe muestra sólo costos identificables. Completá las fichas y precios indicados en Datos pendientes para obtener el total.</p>}
                {data.resumen.costoCompleto && <p style={{ marginBottom: 0 }}>El costo está completo según las fichas cargadas; el sistema no puede detectar ingredientes omitidos en una ficha.</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {([['productos', 'Paquetes producidos'], ['insumos', 'Insumos utilizados'], ['evolucion', 'Evolución diaria'], ['pendientes', `Datos pendientes (${data.resumen.lotesPendientes})`]] as const).map(([claveVista, titulo]) =>
                    <button type="button" key={claveVista} className={`btn ${vista === claveVista ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setVista(claveVista)}>{titulo}</button>)}
            </div>
            {vista === 'productos' && <div className="card" style={{ padding: 20 }}>
                <h3 style={{ marginTop: 0 }}>Producción por paquete</h3>
                <div style={{ overflowX: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Producto</th><th>Presentación</th><th>Producidos</th><th>Buenos</th><th>Rechazados</th><th>Costo identificado</th><th>Ficha y precios</th></tr></thead><tbody>
                    {data.porProducto.map(item => <tr key={item.clave} onClick={() => setProductoElegido(item.clave)} style={{ cursor: 'pointer', background: seleccionado?.clave === item.clave ? 'var(--color-gray-50)' : undefined }}><td>{item.producto}</td><td>x{item.presentacion}</td><td>{numero(item.paquetes)}</td><td>{numero(item.buenos)}</td><td>{numero(item.rechazados)}</td><td>{dinero(item.costoIdentificado)}</td><td>{item.costoCompleto ? 'Completo' : 'Parcial'}</td></tr>)}
                </tbody></table></div>
                {!data.porProducto.length && <p>No hay paquetes confirmados con presentación identificable en este período.</p>}
                {seleccionado && <div style={{ marginTop: 20 }}><h4>Insumos de {seleccionado.producto} x{seleccionado.presentacion}</h4><div style={{ overflowX: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo</th><th>Cantidad teórica</th><th>Unidad</th><th>Precio actual</th><th>Costo identificado</th></tr></thead><tbody>{seleccionado.insumos.map(item => <tr key={item.id}><td>{item.nombre}</td><td>{numero(item.cantidad)}</td><td>{item.unidad}</td><td>{item.precioValido ? dinero(item.precioUnitario) : 'Sin precio'}</td><td>{item.precioValido ? dinero(item.costoIdentificado) : 'Pendiente'}</td></tr>)}</tbody></table></div></div>}
            </div>}
            {vista === 'insumos' && <div className="card" style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Total teórico por insumo</h3><div style={{ overflowX: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo</th><th>Cantidad utilizada</th><th>Unidad</th><th>Precio actual</th><th>Costo identificado</th></tr></thead><tbody>{data.porInsumo.map(item => <tr key={item.id}><td>{item.nombre}</td><td>{numero(item.cantidad)}</td><td>{item.unidad}</td><td>{item.precioValido ? dinero(item.precioUnitario) : 'Sin precio'}</td><td>{item.precioValido ? dinero(item.costoIdentificado) : 'Parcial'}</td></tr>)}</tbody></table></div>{!data.porInsumo.length && <p>No hay insumos calculables en este período.</p>}</div>}
            {vista === 'evolucion' && <div className="card" style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Evolución por fecha de producción</h3>{data.porDia.length > 0 && <div style={{ height: 280 }}><Bar data={{ labels: data.porDia.map(item => item.fecha), datasets: [{ label: 'Paquetes producidos', data: data.porDia.map(item => item.paquetes), backgroundColor: '#cf1735' }] }} options={{ responsive: true, maintainAspectRatio: false }} /></div>}<div style={{ overflowX: 'auto', marginTop: 16 }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Fecha</th><th>Lotes</th><th>Producidos</th><th>Rechazados</th><th>Costo identificado</th><th>Cobertura</th></tr></thead><tbody>{data.porDia.map(item => <tr key={item.fecha}><td>{item.fecha}</td><td>{numero(item.lotes)}</td><td>{numero(item.paquetes)}</td><td>{numero(item.rechazados)}</td><td>{dinero(item.costoIdentificado)}</td><td>{item.costoCompleto ? 'Completo' : 'Parcial'}</td></tr>)}</tbody></table></div>{!data.porDia.length && <p>No hay lotes confirmados en este período.</p>}</div>}
            {vista === 'pendientes' && <div className="card" style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Lotes con datos pendientes</h3><div style={{ overflowX: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Fecha</th><th>Lote</th><th>Producto</th><th>Paquetes</th><th>Motivos</th></tr></thead><tbody>{data.pendientes.map(item => <tr key={item.loteId}><td>{item.fecha}</td><td>{item.loteId}</td><td>{item.producto}</td><td>{numero(item.paquetes)}</td><td>{item.motivos.join('; ')}</td></tr>)}</tbody></table></div>{!data.pendientes.length && <p>No hay datos pendientes para los lotes confirmados.</p>}</div>}
            <p style={{ marginTop: 18, color: 'var(--color-gray-600)' }}>Este reporte estima insumos de lo producido con recetas y precios vigentes. No representa compras, consumo físico medido, descuento adicional de stock ni egresos de Caja. Los períodos anteriores se recalculan si cambian fichas o precios.</p>
        </>}
    </div>
}
