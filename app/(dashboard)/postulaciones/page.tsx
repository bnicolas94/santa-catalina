'use client'

import { useEffect, useState } from 'react'
import { contenidoPrueba, type Respuestas } from '@/lib/postulaciones/prueba'
import type { PlanillaResultado, RespuestasV3 } from '@/lib/postulaciones/habilidades'
import RevisionHabilidades from './RevisionHabilidades'
import styles from './page.module.css'

type Revision = { tipeo: number | null; atencion: number | null; pedidos: number | null; rutas: number | null; criterio: number | null; observaciones: string }
type BasePrueba = { id: string; nombre: string; email: string | null; venceAt: string; inicioAt: string | null; entregaAt: string | null; anuladaAt: string | null; createdAt: string }
type Prueba = (BasePrueba & { version: 1 | 2; respuestas?: Respuestas | null; revision: Revision | null })
    | (BasePrueba & { version: 3; respuestas?: RespuestasV3 | null; revision: { comunicacion: number; observaciones: string } | null; tipeoInicioAt?: string | null; tipeoFinAt?: string | null; tipeoTexto?: string | null; planilla?: PlanillaResultado | null })
const criterios = [
    { key: 'tipeo', label: 'Tipeo y precisión', peso: 10 },
    { key: 'atencion', label: 'Atención al cliente', peso: 25 },
    { key: 'pedidos', label: 'Registro de datos', peso: 30 },
    { key: 'rutas', label: 'Organización de entregas', peso: 25 },
    { key: 'criterio', label: 'Criterio operativo', peso: 10 },
] as const
const revisionVacia = (): Revision => ({ tipeo: null, atencion: null, pedidos: null, rutas: null, criterio: null, observaciones: '' })
const fecha = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value))

export default function PostulacionesPage() {
    const [pruebas, setPruebas] = useState<Prueba[]>([])
    const [seleccion, setSeleccion] = useState<Prueba | null>(null)
    const [revision, setRevision] = useState<Revision>(revisionVacia)
    const [nombre, setNombre] = useState('')
    const [email, setEmail] = useState('')
    const [enlace, setEnlace] = useState('')
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)

    async function cargar() {
        setCargando(true)
        try {
            const res = await fetch('/api/postulaciones', { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las pruebas')
            setPruebas(data)
        } catch (err) { setError(err instanceof Error ? err.message : 'Error de carga') }
        finally { setCargando(false) }
    }
    useEffect(() => { void cargar() }, [])

    async function crear() {
        setGuardando(true); setError(''); setMensaje(''); setEnlace('')
        try {
            const res = await fetch('/api/postulaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, email }) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo crear el enlace')
            setEnlace(`${window.location.origin}/prueba/${data.token}`)
            setNombre(''); setEmail('')
            await cargar()
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear') }
        finally { setGuardando(false) }
    }
    async function abrir(id: string) {
        setError(''); setMensaje('')
        try {
            const res = await fetch(`/api/postulaciones/${id}`, { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo abrir')
            setSeleccion(data); setRevision(data.version === 3 ? revisionVacia() : data.revision || revisionVacia())
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo abrir') }
    }
    async function actualizar(body: unknown) {
        if (!seleccion) return
        setGuardando(true); setError(''); setMensaje('')
        try {
            const res = await fetch(`/api/postulaciones/${seleccion.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo actualizar')
            await abrir(seleccion.id); await cargar(); setMensaje('Cambios guardados.')
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
        finally { setGuardando(false) }
    }
    const total = Math.round(criterios.reduce((sum, c) => sum + (revision[c.key] ?? 0) * c.peso / 5, 0))
    const completa = criterios.every(c => revision[c.key] !== null)
    const estado = (p: Prueba) => p.anuladaAt ? 'Anulada' : p.entregaAt ? 'Entregada' : p.inicioAt ? 'En curso' : new Date(p.venceAt) < new Date() ? 'Vencida' : 'Pendiente'
    const contenidoSeleccion = contenidoPrueba(seleccion?.version ?? 2)

    return <div className={styles.page}>
        <header className={styles.header}><div><span className={styles.eyebrow}>PERSONAL · SELECCIÓN</span><h1>Postulaciones</h1><p>Prueba remota para el área administrativa. Cada enlace es individual y vence a los 7 días.</p></div></header>
        {error && <p className={styles.error} role="alert">{error}</p>}{mensaje && <p className={styles.success}>{mensaje}</p>}
        <section className={styles.card}><h2>Invitar a un postulante</h2><div className={styles.invite}><label>Nombre<input value={nombre} maxLength={120} onChange={e => setNombre(e.target.value)} /></label><label>Email (opcional)<input value={email} type="email" maxLength={254} onChange={e => setEmail(e.target.value)} /></label><button className={styles.primary} disabled={guardando || !nombre.trim()} onClick={crear}>Crear enlace</button></div>
            {enlace && <div className={styles.linkBox}><strong>Enlace listo para compartir</strong><input readOnly value={enlace} aria-label="Enlace de la prueba" onFocus={e => e.target.select()} /><button onClick={async () => { await navigator.clipboard.writeText(enlace); setMensaje('Enlace copiado.') }}>Copiar enlace</button><small>Guardalo ahora: por seguridad, el enlace completo se muestra sólo al crearlo.</small></div>}
        </section>
        <section className={styles.card}><h2>Pruebas recientes</h2>{cargando ? <p>Cargando…</p> : pruebas.length ? <div className={styles.tableWrap}><table><thead><tr><th>Postulante</th><th>Creada</th><th>Estado</th><th>Revisión</th><th></th></tr></thead><tbody>{pruebas.map(p => <tr key={p.id}><td><strong>{p.nombre}</strong><small>{p.email}</small></td><td>{fecha(p.createdAt)}</td><td>{estado(p)}</td><td>{p.revision ? 'Revisada' : '—'}</td><td><button onClick={() => abrir(p.id)}>Ver</button></td></tr>)}</tbody></table></div> : <p>Todavía no hay pruebas.</p>}</section>
        {seleccion && <section className={styles.card} id="detalle"><div className={styles.detailHead}><div><span className={styles.eyebrow}>DETALLE</span><h2>{seleccion.nombre}</h2><p>{seleccion.email || 'Sin email'} · {estado(seleccion)} · creada {fecha(seleccion.createdAt)}</p></div><button onClick={() => setSeleccion(null)}>Cerrar</button></div>
            {!seleccion.entregaAt && !seleccion.anuladaAt && <button className={styles.danger} disabled={guardando} onClick={() => { if (window.confirm('¿Anular este enlace? El postulante no podrá entregar la prueba.')) void actualizar({ accion: 'anular' }) }}>Anular enlace</button>}
            {seleccion.version === 3 && seleccion.entregaAt && <RevisionHabilidades key={seleccion.id} prueba={seleccion} onSave={actualizar} guardando={guardando} />}
            {seleccion.version !== 3 && seleccion.entregaAt && seleccion.respuestas && <><p>Entregada el {fecha(seleccion.entregaAt)}. Versión {seleccion.version}.</p><div className={styles.answer}><h3>1. Tipeo</h3><strong>Texto original</strong><p className={styles.pre}>{contenidoSeleccion.textoTipeo}</p><strong>Transcripción</strong><p className={styles.pre}>{seleccion.respuestas.tipeo}</p></div><div className={styles.answer}><h3>2. Comunicación</h3>{seleccion.respuestas.whatsapp.map((v, i) => <div key={i}><strong>{contenidoSeleccion.casosWhatsapp[i]?.mensaje}</strong><p className={styles.pre}>{v}</p></div>)}</div><div className={styles.answer}><h3>3. Registro</h3><div className={styles.tableWrap}><table><thead><tr><th>Chat</th><th>Cliente</th><th>{seleccion.version >= 2 ? 'Artículo' : 'Producto'}</th><th>Cantidad</th><th>Fecha</th><th>Horario</th><th>Dirección</th><th>Estado</th></tr></thead><tbody>{seleccion.respuestas.pedidos.map((row, i) => <tr key={i}><td>{'ABCD'[i]}</td><td>{row.cliente}</td><td>{row.producto}</td><td>{row.cantidad}</td><td>{row.fecha}</td><td>{row.horario}</td><td>{row.direccion}</td><td>{row.estado}</td></tr>)}</tbody></table></div></div><div className={styles.answer}><h3>4. Organización</h3><p className={styles.pre}>{seleccion.respuestas.rutas}</p></div><div className={styles.answer}><h3>5. Criterio</h3><p className={styles.pre}>{seleccion.respuestas.criterio}</p></div>
                <div className={styles.review}><h3>Revisión</h3><p>Puntuá cada criterio de 0 a 5. Total orientativo: <strong>{completa ? total : '—'}/100</strong>.</p><p>Guía: {contenidoSeleccion.guiaRevision}</p><div className={styles.scores}>{criterios.map(c => <label key={c.key}>{c.label} · {c.peso}%<select value={revision[c.key] ?? ''} onChange={e => setRevision(v => ({ ...v, [c.key]: e.target.value === '' ? null : Number(e.target.value) }))}><option value="">Sin puntuar</option>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>)}</div><label>Observaciones<textarea rows={4} maxLength={4000} value={revision.observaciones} onChange={e => setRevision(v => ({ ...v, observaciones: e.target.value }))} /></label><button className={styles.primary} disabled={guardando || !completa} onClick={() => actualizar(revision)}>Guardar revisión</button></div>
            </>}
        </section>}
    </div>
}
