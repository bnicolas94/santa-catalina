'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { estadoSolucion } from '@/lib/diario-errores'
import styles from './page.module.css'

type Area = { id: string; nombre: string; activa: boolean }
type Registro = { id: string; fecha: string; areaId: string; area: Area; error: string; responsable: string; solucion: string; solucionado: boolean | null; creadoPorId: string; creadoPorNombre: string; updatedAt: string }
type Formulario = { fecha: string; areaId: string; error: string; responsable: string; solucion: string; solucionado: boolean }
type Listado = { registros: Registro[]; total: number; pagina: number; resumen: { total: number; solucionados: number; noSolucionados: number; sinConfirmar: number } }
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const inicial = (): Formulario => ({ fecha: hoy(), areaId: '', error: '', responsable: '', solucion: '', solucionado: false })
const mostrarFecha = (fecha: string) => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
async function cargar<T,>(url: string): Promise<T> {
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'No se pudo cargar el diario')
    return data
}

export default function DiarioErroresPage() {
    const { data: session } = useSession()
    const user = session?.user as { id?: string; rol?: string } | undefined
    const admin = user?.rol === 'ADMIN'
    const [filtros, setFiltros] = useState({ q: '', areaId: '', desde: '', hasta: '' })
    const [busqueda, setBusqueda] = useState('')
    const [pagina, setPagina] = useState(1)
    const [vista, setVista] = useState<'diario' | 'areas'>('diario')
    const [form, setForm] = useState<Formulario | null>(null)
    const [editando, setEditando] = useState<Registro | null>(null)
    const [areaForm, setAreaForm] = useState({ id: '', nombre: '', activa: true })
    const [guardando, setGuardando] = useState(false)
    const [exportando, setExportando] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const editor = useRef<HTMLDivElement>(null)
    const params = new URLSearchParams({ ...filtros, pagina: String(pagina) }).toString()
    const { data, error: errorCarga, isLoading, mutate } = useSWR<Listado>(`/api/diario-errores?${params}`, cargar)
    const { data: areas, error: errorAreas, mutate: recargarAreas } = useSWR<Area[]>('/api/diario-errores/areas', cargar)

    useEffect(() => {
        const timer = setTimeout(() => { setFiltros(prev => ({ ...prev, q: busqueda })); setPagina(1) }, 300)
        return () => clearTimeout(timer)
    }, [busqueda])

    function cambiarFiltro(campo: keyof typeof filtros, valor: string) {
        setFiltros(prev => ({ ...prev, [campo]: valor })); setPagina(1)
    }
    function abrir(registro?: Registro) {
        if (form && !window.confirm('¿Descartar el formulario actual?')) return
        setEditando(registro || null); setForm(registro ? { fecha: registro.fecha, areaId: registro.areaId, error: registro.error, responsable: registro.responsable, solucion: registro.solucion, solucionado: registro.solucionado === true } : inicial())
        setVista('diario'); setError(''); setMensaje('')
        setTimeout(() => { editor.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); editor.current?.querySelector('input')?.focus() }, 50)
    }
    function cerrar() {
        if (!window.confirm('¿Descartar los cambios sin guardar?')) return
        setForm(null); setEditando(null); setError('')
    }
    async function enviar(url: string, method: string, body: unknown) {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'No se pudo guardar')
    }
    async function guardarRegistro() {
        setGuardando(true); setError(''); setMensaje('')
        try {
            await enviar('/api/diario-errores', editando ? 'PATCH' : 'POST', { ...form, ...(editando ? { id: editando.id, updatedAt: editando.updatedAt } : {}) })
            setForm(null); setEditando(null); setMensaje('Registro guardado. Ya forma parte del diario.'); await mutate()
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
        finally { setGuardando(false) }
    }
    async function guardarArea(datos = areaForm) {
        setGuardando(true); setError(''); setMensaje('')
        try {
            await enviar('/api/diario-errores/areas', datos.id ? 'PATCH' : 'POST', datos)
            setAreaForm({ id: '', nombre: '', activa: true }); setMensaje('Área actualizada correctamente.'); await recargarAreas(); await mutate()
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el área') }
        finally { setGuardando(false) }
    }
    async function exportar() {
        setExportando(true); setError('')
        try {
            const res = await fetch(`/api/diario-errores/reporte?${new URLSearchParams(filtros)}`)
            if (!res.ok) throw new Error((await res.json()).error || 'No se pudo generar el reporte')
            const url = URL.createObjectURL(await res.blob())
            const link = document.createElement('a'); link.href = url; link.download = `diario-errores-${hoy()}.csv`; link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo descargar') }
        finally { setExportando(false) }
    }

    const activas = (areas || []).filter(a => a.activa)
    const resumen = !errorCarga && !isLoading ? data?.resumen : undefined
    return <div className={styles.page}>
        <header className={styles.header}>
            <div><span className={styles.eyebrow}>MEJORA CONTINUA · SANTA CATALINA</span><h1>Diario de errores<span>.</span></h1><p>Lo registramos hoy. Lo hacemos mejor mañana.</p></div>
            <div className={styles.actions}><button className={styles.secondary} disabled={exportando || !data?.total || !!errorCarga || isLoading} onClick={exportar}>{exportando ? 'Preparando…' : '↓ Descargar reporte'}</button><button className={styles.primary} disabled={guardando} onClick={() => abrir()}>+ Registrar error</button></div>
        </header>
        <section className={styles.summary} aria-label="Conteo de incidentes" aria-busy={isLoading}>
            <div className={styles.summaryHeading}><h2>Incidentes de un vistazo</h2><p>{Object.values(filtros).some(Boolean) ? 'Según los filtros del diario · todas las páginas' : 'Todo el historial del diario'}</p></div>
            <dl className={styles.stats}>
                <div className={styles.stat}><dt><span aria-hidden="true">▤</span>Total de incidentes</dt><dd>{resumen?.total.toLocaleString('es-AR') ?? '—'}</dd><p>Incidentes registrados</p></div>
                <div className={`${styles.stat} ${styles.statSolved}`}><dt><span aria-hidden="true">✓</span>Solucionados</dt><dd>{resumen?.solucionados.toLocaleString('es-AR') ?? '—'}</dd><p>Se pudo resolver el incidente</p></div>
                <div className={`${styles.stat} ${styles.statUnsolved}`}><dt><span aria-hidden="true">○</span>No solucionados</dt><dd>{resumen?.noSolucionados.toLocaleString('es-AR') ?? '—'}</dd><p>No se pudo resolver el incidente</p></div>
                {!!resumen?.sinConfirmar && <div className={`${styles.stat} ${styles.statUnknown}`}><dt><span aria-hidden="true">?</span>Sin confirmar</dt><dd>{resumen.sinConfirmar.toLocaleString('es-AR')}</dd><p>Registros anteriores sin estado</p></div>}
            </dl>
            {!!resumen?.sinConfirmar && <p className={styles.summaryNote}>Los registros anteriores quedan sin confirmar. Editalos para indicar si se pudieron solucionar.</p>}
        </section>
        <div className={styles.intro}><span className={styles.book} aria-hidden="true">↗</span><div><strong>Cada error es una oportunidad de mejorar</strong><p>Contá qué pasó, quién estuvo involucrado y cómo se resolvió. Un registro claro ayuda a evitar que vuelva a ocurrir.</p></div><span className={styles.introTag}>Un día a la vez</span></div>
        <nav className={styles.tabs} aria-label="Secciones del diario"><button aria-current={vista === 'diario' ? 'page' : undefined} onClick={() => setVista('diario')}>Diario <span>{data?.total ?? '—'}</span></button>{admin && <button disabled={guardando} aria-current={vista === 'areas' ? 'page' : undefined} onClick={() => { if (form) { if (!window.confirm('¿Descartar el formulario para configurar las áreas?')) return; setForm(null); setEditando(null) } setError(''); setVista('areas') }}>Configurar áreas</button>}</nav>
        {(error || errorCarga || errorAreas) && <div className={styles.alert} role="alert">{error || errorCarga?.message || errorAreas?.message}{(errorCarga || errorAreas) && <button onClick={() => { void mutate(); void recargarAreas() }}>Reintentar</button>}</div>}
        {mensaje && <div className={styles.success} role="status">✓ {mensaje}</div>}

        {vista === 'diario' ? <div className={`${styles.workspace} ${form ? styles.withEditor : ''}`}>
            <section aria-label="Historial de errores">
                <div className={styles.filters}>
                    <label className={styles.search}>Buscar<input type="search" placeholder="Error, responsable o solución…" maxLength={150} value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label>
                    <label>Área<select value={filtros.areaId} onChange={e => cambiarFiltro('areaId', e.target.value)}><option value="">Todas las áreas</option>{areas?.map(a => <option key={a.id} value={a.id}>{a.nombre}{a.activa ? '' : ' (inactiva)'}</option>)}</select></label>
                    <label>Desde<input type="date" value={filtros.desde} onChange={e => cambiarFiltro('desde', e.target.value)} /></label>
                    <label>Hasta<input type="date" value={filtros.hasta} onChange={e => cambiarFiltro('hasta', e.target.value)} /></label>
                </div>
                <div className={styles.results}><span>{data ? `${data.total} ${data.total === 1 ? 'registro' : 'registros'}` : 'Historial'} · más recientes primero</span>{Object.values(filtros).some(Boolean) && <button onClick={() => { setBusqueda(''); setFiltros({ q: '', areaId: '', desde: '', hasta: '' }); setPagina(1) }}>Limpiar filtros</button>}</div>
                {isLoading ? <div className={styles.empty} role="status">Cargando el diario…</div> : errorCarga ? null : !data?.registros.length ? <div className={styles.empty}><span aria-hidden="true">▤</span><h2>{Object.values(filtros).some(Boolean) ? 'No encontramos registros' : 'Un espacio para aprender'}</h2><p>{Object.values(filtros).some(Boolean) ? 'Probá con otra búsqueda, área o rango de fechas.' : 'Registrá el primer error del día y dejá por escrito cómo lo resolvieron.'}</p><button className={styles.primary} onClick={() => abrir()}>+ Registrar error</button></div> : <div className={styles.timeline}>
                    {data.registros.map((r, i) => <div key={r.id}>
                        {(i === 0 || data.registros[i - 1].fecha !== r.fecha) && <h2 className={styles.day}>{r.fecha === hoy() && <span>HOY</span>}{mostrarFecha(r.fecha)}</h2>}
                        <article className={styles.card}>
                            <div className={styles.cardTop}><span className={styles.badge}>{r.area.nombre}</span><span className={r.solucionado === true ? styles.solved : r.solucionado === false ? styles.unsolved : styles.pending}>{r.solucionado === true ? '✓' : r.solucionado === false ? '○' : '?'} {estadoSolucion(r.solucionado)}</span></div>
                            <h3>Qué ocurrió</h3><p className={styles.description}>{r.error}</p>
                            <div className={styles.person}><span aria-hidden="true">{r.responsable.charAt(0).toUpperCase()}</span><div><small>Responsable</small><strong>{r.responsable}</strong></div></div>
                            <div className={styles.solution}><h3>Solución brindada</h3><p>{r.solucion || 'Todavía no se registró una solución. Podés completarla al editar.'}</p></div>
                            <footer><small>Registrado por {r.creadoPorNombre}</small>{(admin || r.creadoPorId === user?.id) && <button disabled={guardando} onClick={() => abrir(r)}>Editar registro ↗</button>}</footer>
                        </article>
                    </div>)}
                </div>}
                {!!data?.total && <div className={styles.pagination}><button className={styles.secondary} disabled={pagina === 1 || isLoading} onClick={() => setPagina(p => p - 1)}>← Anterior</button><span>Página {pagina} de {Math.max(1, Math.ceil(data.total / 20))}</span><button className={styles.secondary} disabled={pagina * 20 >= data.total || isLoading} onClick={() => setPagina(p => p + 1)}>Siguiente →</button></div>}
            </section>
            {form && <aside className={styles.editor} ref={editor} aria-labelledby="titulo-registro"><div className={styles.editorTitle}><div><span className={styles.eyebrow}>{editando ? 'ACTUALIZAR EL DIARIO' : 'UN NUEVO APRENDIZAJE'}</span><h2 id="titulo-registro">{editando ? 'Editar registro' : 'Registrar error'}</h2></div><button aria-label="Cerrar formulario" disabled={guardando} onClick={cerrar}>×</button></div><p className={styles.hint}>Los campos con * son obligatorios.</p>
                <form onSubmit={e => { e.preventDefault(); void guardarRegistro() }}>
                    <fieldset disabled={guardando}>
                        <label>Fecha del error *<input type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
                        <label>Área *<select required value={form.areaId} onChange={e => setForm({ ...form, areaId: e.target.value })}><option value="">Seleccioná un área</option>{areas?.filter(a => a.activa || a.id === editando?.areaId).map(a => <option key={a.id} value={a.id}>{a.nombre}{a.activa ? '' : ' (inactiva)'}</option>)}</select></label>
                        {!activas.length && <p className={styles.hint}>{admin ? 'Creá o activá un área desde Configurar áreas.' : 'Pedile a un administrador que configure las áreas.'}</p>}
                        <label>¿Qué ocurrió? *<textarea required maxLength={4000} rows={4} placeholder="Ej.: No se agendó correctamente el pedido en Excel." value={form.error} onChange={e => setForm({ ...form, error: e.target.value })} /></label>
                        <label>Responsable *<input required maxLength={150} placeholder="Ej.: Karen" value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })} /></label>
                        <label className={`${styles.resolutionCheck} ${form.solucionado ? styles.resolutionChecked : ''}`}><input type="checkbox" checked={form.solucionado} onChange={e => setForm({ ...form, solucionado: e.target.checked })} aria-describedby="ayuda-solucionado" /><span><strong>Se pudo solucionar</strong><small id="ayuda-solucionado">{form.solucionado ? 'Se contará como solucionado.' : 'Sin marcar, se contará como no solucionado.'}</small></span></label>
                        {editando?.solucionado === null && <p className={styles.hint}>Este registro no tenía un estado confirmado. Al guardar se registrará la opción que elijas.</p>}
                        <label>Solución brindada <small>Opcional</small><textarea maxLength={4000} rows={4} placeholder="Ej.: Se le ofreció llevarle el paquete a domicilio." value={form.solucion} onChange={e => setForm({ ...form, solucion: e.target.value })} /></label>
                        <p className={styles.hint}>Si todavía no hay una solución, podés agregarla más adelante.</p>
                        {error && <p role="alert" className={styles.inlineError}>{error}</p>}
                        <button className={styles.primary} disabled={!areas || !!errorAreas || (!activas.length && !editando)}>{guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar registro'}</button><button className={styles.secondary} type="button" onClick={cerrar}>Cancelar</button>
                    </fieldset>
                </form></aside>}
        </div> : admin && <section className={styles.areaSection}><div><span className={styles.eyebrow}>ORGANIZÁ TU DIARIO</span><h2>Las áreas de tu equipo</h2><p>Creá las áreas que necesitás. Al desactivar una, sus registros se conservan y deja de estar disponible para nuevas cargas.</p><form className={styles.areaForm} onSubmit={e => { e.preventDefault(); void guardarArea() }}><label>{areaForm.id ? 'Editar nombre del área' : 'Nueva área'}<input required maxLength={80} placeholder="Ej.: Atención al cliente" value={areaForm.nombre} disabled={guardando} onChange={e => setAreaForm({ ...areaForm, nombre: e.target.value })} /></label><button className={styles.primary} disabled={guardando}>{guardando ? 'Guardando…' : areaForm.id ? 'Guardar nombre' : '+ Crear área'}</button>{areaForm.id && <button type="button" className={styles.secondary} disabled={guardando} onClick={() => setAreaForm({ id: '', nombre: '', activa: true })}>Cancelar</button>}</form></div><div className={styles.areaList}>{!areas ? <p>Cargando áreas…</p> : areas.length === 0 ? <p>Todavía no hay áreas. Creá la primera para comenzar.</p> : areas.map(a => <div className={styles.areaRow} key={a.id}><div><strong>{a.nombre}</strong><small>{a.activa ? 'Disponible para nuevos registros' : 'Inactiva · historial conservado'}</small></div><button className={styles.secondary} disabled={guardando} onClick={() => setAreaForm(a)}>Editar</button><button className={styles.secondary} disabled={guardando} onClick={() => { if (a.activa && !window.confirm(`¿Desactivar el área ${a.nombre}? Se conservarán sus registros.`)) return; void guardarArea({ ...a, activa: !a.activa }) }}>{a.activa ? 'Desactivar' : 'Reactivar'}</button></div>)}</div></section>}
    </div>
}
