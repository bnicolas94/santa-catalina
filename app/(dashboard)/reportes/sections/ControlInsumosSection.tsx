'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { calcularConciliacionInsumos } from '@/lib/reportes/conciliacion-insumos'

type Resultado = ReturnType<typeof calcularConciliacionInsumos> & {
    sede: string; inicio: { id: string; fecha: string }; fin: { id: string; fecha: string }
    personalizados: { estado: 'incluidos' | 'parcial' | 'sin_dias_completos' | 'sin_asignacion' | 'sin_fuente';
        desde: string | null; hasta: string | null; pedidos: number; paquetes: number;
        filasPendientes: number; faltantes: string[]; sinConteo: string[];
        insumos: { id: string; nombre: string; unidad: string; cantidad: number }[] }
}
type Listado = { sede: { id: string; nombre: string }; conteos: { id: string; fecha: string; insumos: number }[] }
type Estado = Resultado['filas'][number]['estado']
const numero = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 })
const dinero = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })
const etiqueta: Record<Estado, string> = {
    faltante: 'Faltante por investigar', sobrante: 'Sobrante por investigar', coincide: 'Coincide', revisar: 'Revisar movimientos',
}
const color: Record<Estado, string> = { faltante: '#b91c1c', sobrante: '#a16207', coincide: '#047857', revisar: '#6d28d9' }
const csv = (valor: string | number | null) => {
    const texto = String(valor ?? '')
    const seguro = /^[=+@\-\t\r]/.test(texto) && typeof valor === 'string' ? `'${texto}` : texto
    return `"${seguro.replaceAll('"', '""')}"`
}

export default function ControlInsumosSection({ ubicacionId }: { ubicacionId: string }) {
    const [listado, setListado] = useState<{ sedeId: string; data: Listado | null; error: string } | null>(null)
    const [seleccion, setSeleccion] = useState({ sedeId: '', inicioId: '', finId: '' })
    const [consulta, setConsulta] = useState<{ clave: string; data: Resultado | null; error: string } | null>(null)
    const [revision, setRevision] = useState(0)
    const [busqueda, setBusqueda] = useState('')
    const [filtro, setFiltro] = useState<Estado | 'todos'>('todos')
    const [pagina, setPagina] = useState(1)
    const [insumoElegido, setInsumoElegido] = useState('')

    useEffect(() => {
        if (!ubicacionId) return
        const controller = new AbortController()
        fetch(`/api/reportes/conciliacion-insumos?${new URLSearchParams({ ubicacionId })}`, { signal: controller.signal })
            .then(async res => { const json = await res.json(); if (!res.ok) throw new Error(json.error || 'No se pudieron leer los conteos.'); return json as Listado })
            .then(data => {
                if (controller.signal.aborted) return
                setListado({ sedeId: ubicacionId, data, error: '' })
                setSeleccion(actual => actual.sedeId === ubicacionId && data.conteos.some(c => c.id === actual.inicioId)
                    && data.conteos.some(c => c.id === actual.finId) ? actual : {
                    sedeId: ubicacionId, inicioId: data.conteos[1]?.id ?? '', finId: data.conteos[0]?.id ?? '',
                })
            }).catch(error => {
                if (!controller.signal.aborted) setListado({ sedeId: ubicacionId, data: null,
                    error: error instanceof Error ? error.message : 'No se pudieron leer los conteos.' })
            })
        return () => controller.abort()
    }, [ubicacionId, revision])

    const listadoActual = listado?.sedeId === ubicacionId ? listado : null
    const opciones = listadoActual?.data?.conteos ?? []
    const inicio = opciones.find(c => c.id === seleccion.inicioId)
    const fin = opciones.find(c => c.id === seleccion.finId)
    const validos = seleccion.sedeId === ubicacionId && inicio && fin && new Date(inicio.fecha) < new Date(fin.fecha)
    const clave = `${ubicacionId}:${seleccion.inicioId}:${seleccion.finId}:${revision}`

    useEffect(() => {
        if (!validos) return
        const controller = new AbortController()
        const params = new URLSearchParams({ ubicacionId, inicioId: seleccion.inicioId, finId: seleccion.finId })
        fetch(`/api/reportes/conciliacion-insumos?${params}`, { signal: controller.signal })
            .then(async res => { const json = await res.json(); if (!res.ok) throw new Error(json.error || 'No se pudo calcular la comparación.'); return json as Resultado })
            .then(data => { if (!controller.signal.aborted) setConsulta({ clave, data, error: '' }) })
            .catch(error => { if (!controller.signal.aborted) setConsulta({ clave, data: null,
                error: error instanceof Error ? error.message : 'No se pudo calcular la comparación.' }) })
        return () => controller.abort()
    }, [clave, ubicacionId, seleccion.inicioId, seleccion.finId, validos])

    const data = validos && consulta?.clave === clave ? consulta.data : null
    const coberturaCompleta = data?.personalizados.estado === 'incluidos'
    const error = validos && consulta?.clave === clave ? consulta.error : ''
    const filas = useMemo(() => data?.filas.filter(fila =>
        (filtro === 'todos' || fila.estado === filtro) && fila.nombre.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es'))) ?? [],
    [data, filtro, busqueda])
    const totalPaginas = Math.max(1, Math.ceil(filas.length / 10))
    const paginaActual = Math.min(pagina, totalPaginas)
    const visibles = filas.slice((paginaActual - 1) * 10, paginaActual * 10)
    const elegido = filas.find(fila => fila.insumoId === insumoElegido) ?? visibles[0]

    const descargar = () => {
        if (!data) return
        const lineas = [['Insumo', 'Unidad', 'Stock inicial', 'Entradas', 'Otras salidas', 'Uso por lotes', 'Uso personalizados', 'Uso esperado total', 'Uso según conteos', 'Stock esperado', 'Stock contado', 'Diferencia', 'Estado', 'Costo faltante estimado'],
            ...filas.map(f => [f.nombre, f.unidad, f.inicio, f.entradas, f.salidasOtras, f.usoRegistrado,
                f.usoPersonalizados, f.usoEsperado, f.usoSegunConteo, f.stockEsperado, f.fin, f.diferencia,
                !coberturaCompleta && f.estado === 'coincide' ? 'Coincide con datos disponibles' : etiqueta[f.estado], f.costoDiferencia])]
        const contenido = '\uFEFF' + lineas.map(linea => linea.map(csv).join(';')).join('\r\n')
        const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
        const enlace = document.createElement('a')
        enlace.href = url
        enlace.download = `control_insumos_${data.inicio.fecha.slice(0, 10)}_${data.fin.fecha.slice(0, 10)}.csv`
        enlace.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    return <section className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap' }}>
            <div><h2 style={{ margin: '0 0 6px' }}>Control de insumos</h2>
                <p style={{ margin: 0, color: 'var(--color-gray-600)' }}>Comparamos el consumo de paquetes producidos y personalizados entregados con lo que quedó en los conteos físicos.</p></div>
            <Link href="/conteos-insumos" className="btn btn-secondary btn-sm">Ver o cargar conteos</Link>
        </div>
        {!ubicacionId && <div className="card" style={{ padding: 22, marginTop: 20 }}>Elegí una fábrica en el selector de sede para empezar.</div>}
        {ubicacionId && <div className="card" style={{ padding: 20, marginTop: 20, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>1. Elegí el período entre conteos</strong><button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevision(v => v + 1)}>Actualizar</button></div>
            {listadoActual?.error && <p role="alert" style={{ color: 'var(--color-danger)' }}>{listadoActual.error}</p>}
            {!listadoActual && <p>Cargando conteos…</p>}
            {listadoActual?.data && <><p style={{ color: 'var(--color-gray-600)' }}>Fábrica: <strong>{listadoActual.data.sede.nombre}</strong>. Cada conteo es una foto del stock físico en su fecha y hora.</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 260px' }}>Conteo inicial<select className="form-select" style={{ width: '100%', marginTop: 5 }} value={seleccion.sedeId === ubicacionId ? seleccion.inicioId : ''} onChange={e => { setSeleccion(v => ({ ...v, sedeId: ubicacionId, inicioId: e.target.value })); setPagina(1) }}><option value="">Seleccionar…</option>{opciones.map(c => <option key={c.id} value={c.id}>{fecha(c.fecha)} · {c.insumos} insumos</option>)}</select></label>
                    <label style={{ flex: '1 1 260px' }}>Conteo final<select className="form-select" style={{ width: '100%', marginTop: 5 }} value={seleccion.sedeId === ubicacionId ? seleccion.finId : ''} onChange={e => { setSeleccion(v => ({ ...v, sedeId: ubicacionId, finId: e.target.value })); setPagina(1) }}><option value="">Seleccionar…</option>{opciones.map(c => <option key={c.id} value={c.id}>{fecha(c.fecha)} · {c.insumos} insumos</option>)}</select></label>
                </div>
                {opciones.length < 2 && <p style={{ marginBottom: 0 }}>Se necesitan al menos dos conteos confirmados de esta fábrica para comparar.</p>}
                {opciones.length >= 2 && !validos && <p role="alert" style={{ marginBottom: 0, color: 'var(--color-danger)' }}>El conteo final debe ser posterior al inicial.</p>}
            </>}
        </div>}
        {validos && !data && !error && <p>Cruzando conteos y movimientos…</p>}
        {error && <div className="card" role="alert" style={{ padding: 20, color: 'var(--color-danger)' }}>{error}</div>}
        {data && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                {[
                    ['Insumos comparados', String(data.resumen.comparables), '#15243b'],
                    [coberturaCompleta ? 'Coinciden' : 'Coinciden con datos disponibles', String(data.resumen.coinciden), '#047857'],
                    ['Faltantes por investigar', String(data.resumen.faltantes), '#b91c1c'],
                    ['Sobrantes por investigar', String(data.resumen.sobrantes), '#a16207'],
                    [coberturaCompleta ? 'Costo estimado del faltante' : 'Costo del faltante identificado', dinero(data.resumen.costoFaltanteIdentificado), '#15243b'],
                ].map(([titulo, valor, tono]) => <div className="card" key={titulo} style={{ padding: 18, borderTop: `4px solid ${tono}` }}><small>{titulo}</small><strong style={{ display: 'block', marginTop: 6, fontSize: 26, color: tono }}>{valor}</strong></div>)}
            </div>
            {(data.resumen.revisar > 0 || data.resumen.faltantesSinPrecio > 0) && <p role="status" style={{ marginBottom: 18 }}>Hay {data.resumen.revisar} insumos con movimientos para revisar y {data.resumen.faltantesSinPrecio} faltantes sin precio actual. El costo mostrado incluye sólo faltantes con precio.</p>}
            <div className="card" style={{ padding: 18, marginBottom: 18, borderLeft: `4px solid ${coberturaCompleta ? '#047857' : '#a16207'}` }}>
                <strong>Personalizados del Sheet: {data.personalizados.paquetes} paquetes de {data.personalizados.pedidos} pedidos</strong>
                <p style={{ margin: '8px 0 0' }}>Se incluyen los entregados desde {data.personalizados.desde ?? '—'} hasta {data.personalizados.hasta ?? '—'}, según Fecha Entrega. Sus sabores y empaques se calculan con las fichas actuales. No se suman los paquetes cerrados que ya figuran en producción.</p>
                {!coberturaCompleta && <p role="status" style={{ marginBottom: 0, color: '#92400e' }}>Comparación parcial: {data.personalizados.faltantes.join('; ')}. Los insumos no identificados pueden cambiar las diferencias.</p>}
                {data.personalizados.sinConteo.length > 0 && <p style={{ marginBottom: 0 }}>Sin ambos conteos físicos: {data.personalizados.sinConteo.join(', ')}.</p>}
            </div>
            <div className="card" style={{ padding: 18, marginBottom: 18, background: '#f7faf9' }}><strong>¿Qué significa la diferencia?</strong><p style={{ margin: '8px 0 0' }}>Partimos de lo contado al inicio, sumamos entradas y restamos otras salidas, el consumo por lotes y el estimado de personalizados. Eso da el <strong>stock que debería quedar</strong>. Lo comparamos con el conteo final. Una diferencia puede deberse a uso extra, movimientos faltantes o errores de carga.</p></div>
            <div className="card" style={{ padding: 20, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}><div><h3 style={{ margin: 0 }}>2. Revisá los insumos</h3><small>{filas.length} resultados · 10 por página</small></div><button type="button" className="btn btn-secondary btn-sm" onClick={descargar}>Descargar CSV</button></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}><input aria-label="Buscar insumo" className="form-input" placeholder="Buscar insumo…" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }} style={{ flex: '1 1 220px' }} />
                    <select aria-label="Filtrar resultado" className="form-select" value={filtro} onChange={e => { setFiltro(e.target.value as Estado | 'todos'); setPagina(1) }} style={{ flex: '0 1 240px' }}><option value="todos">Todos los resultados</option><option value="faltante">Faltantes</option><option value="sobrante">Sobrantes</option><option value="coincide">Coinciden</option><option value="revisar">Revisar movimientos</option></select></div>
                <div style={{ overflowX: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo</th><th>Paquetes de stock</th><th>Personalizados</th><th>Uso esperado</th><th>Uso según conteos</th><th>Diferencia</th><th>Resultado</th><th></th></tr></thead><tbody>{visibles.map(f => <tr key={f.insumoId}><td><strong>{f.nombre}</strong><br/><small>{f.unidad}</small></td><td>{numero(f.usoRegistrado)} {f.unidad}</td><td>{numero(f.usoPersonalizados)} {f.unidad}</td><td><strong>{numero(f.usoEsperado)} {f.unidad}</strong></td><td>{numero(f.usoSegunConteo)} {f.unidad}</td><td style={{ color: color[f.estado], fontWeight: 700 }}>{f.diferencia > 0 ? '+' : ''}{numero(f.diferencia)} {f.unidad}</td><td><span style={{ color: color[f.estado], fontWeight: 700 }}>{!coberturaCompleta && f.estado === 'coincide' ? 'Coincide con datos disponibles' : etiqueta[f.estado]}</span></td><td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setInsumoElegido(f.insumoId)}>Ver cálculo</button></td></tr>)}</tbody></table></div>
                {!filas.length && <p>No hay insumos para este filtro o no fueron contados en ambos extremos.</p>}
                {totalPaginas > 1 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'end', gap: 10, marginTop: 14 }}><button className="btn btn-secondary btn-sm" disabled={paginaActual === 1} onClick={() => setPagina(v => v - 1)}>Anterior</button><span>Página {paginaActual} de {totalPaginas}</span><button className="btn btn-secondary btn-sm" disabled={paginaActual === totalPaginas} onClick={() => setPagina(v => v + 1)}>Siguiente</button></div>}
            </div>
            {elegido && <div className="card" style={{ padding: 20, marginBottom: 18 }}><h3 style={{ marginTop: 0 }}>3. Así se calculó: {elegido.nombre}</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[[`Había al inicio`, elegido.inicio], ['Entradas registradas', elegido.entradas], ['Otras salidas', -elegido.salidasOtras], ['Uso por lotes', -elegido.usoRegistrado], ['Uso por personalizados', -elegido.usoPersonalizados], ['Debería quedar', elegido.stockEsperado], ['Se contó al final', elegido.fin]].map(([titulo, valor]) => <div key={titulo} style={{ padding: 14, borderRadius: 10, background: 'var(--color-gray-50)' }}><small>{titulo}</small><strong style={{ display: 'block', marginTop: 5 }}>{numero(Number(valor))} {elegido.unidad}</strong></div>)}</div>
                <p style={{ marginBottom: 0 }}>Diferencia: <strong style={{ color: color[elegido.estado] }}>{elegido.diferencia > 0 ? '+' : ''}{numero(elegido.diferencia)} {elegido.unidad}</strong>. {etiqueta[elegido.estado]}. {elegido.estado === 'faltante' && elegido.costoDiferencia !== null && `Valor estimado con precio actual: ${dinero(elegido.costoDiferencia)}.`} {elegido.movimientosNoReconocidos > 0 && `${elegido.movimientosNoReconocidos} movimientos requieren revisión de tipo o cantidad.`}</p>
            </div>}
            {data.sinPar.length > 0 && <div className="card" style={{ padding: 18, marginBottom: 18 }}><strong>Insumos sin comparación</strong><p style={{ marginBottom: 0 }}>No aparecen en ambos conteos: {data.sinPar.join(', ')}. Para compararlos, incluilos en el próximo conteo.</p></div>}
            <p style={{ color: 'var(--color-gray-600)' }}>Los lotes usan movimientos con fecha y hora; los personalizados usan Fecha Entrega como aproximación del día de elaboración, desde el día siguiente al conteo inicial hasta el día del conteo final. El Sheet no aporta hora de elaboración, por lo que los pedidos de los días límite pueden no coincidir exactamente con la hora del conteo. Las cantidades de personalizados se recalculan con las fichas actuales. Ningún resultado modifica el stock.</p>
        </>}
    </section>
}
