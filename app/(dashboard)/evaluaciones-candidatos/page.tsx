'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from '../postulaciones/page.module.css'
import extra from './page.module.css'
import Configuracion from '@/components/evaluacion-candidatos/Configuracion'
import RevisionPractica from '@/components/evaluacion-candidatos/RevisionPractica'
import type { Plan } from '@/lib/evaluacion-candidatos/tipos'

type Candidato = { id: string; nombre: string; apellido: string; telefono: string | null; email: string | null; createdAt: string; invitacionId: string | null; invitacionAt: string | null; invitacionEstado: string | null; intentoEstado: string | null; inicioAt: string | null; finAt: string | null }
type Invitacion = { id: string; estado: string; createdAt: string; venceAt: string; revocadaAt: string | null; intento: { id: string; plan?: Plan | null; estado: string; inicioAt: string; finAt: string | null; respuestas: { modulo: string; datos: { texto?: string }; updatedAt: string }[]; resultado: unknown } | null }
type Detalle = { id: string; nombre: string; apellido: string; telefono: string | null; email: string | null; observaciones: string | null; createdAt: string; invitaciones: Invitacion[] }
type Lista = { candidatos: Candidato[]; totalFiltrado: number; pagina: number; porPagina: number; resumen: Record<string, number> }
const vacio = { nombre: '', apellido: '', telefono: '', email: '', observaciones: '' }
const fecha = (valor: string | null) => valor ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(valor)) : '—'
const nombreEstado: Record<string, string> = { PENDIENTE: 'Pendiente', UTILIZADA: 'Utilizada', VENCIDA: 'Vencida', REVOCADA: 'Revocada', EN_PROGRESO: 'En progreso', COMPLETADO: 'Completada' }

export default function EvaluacionesCandidatosPage() {
    const [lista, setLista] = useState<Lista | null>(null)
    const [detalle, setDetalle] = useState<Detalle | null>(null)
    const [form, setForm] = useState(vacio)
    const [edicion, setEdicion] = useState(vacio)
    const [q, setQ] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [estado, setEstado] = useState('')
    const [orden, setOrden] = useState('recientes')
    const [pagina, setPagina] = useState(1)
    const [enlace, setEnlace] = useState('')
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [ocupado, setOcupado] = useState(false)

    const cargar = useCallback(async () => {
        const params = new URLSearchParams({ pagina: String(pagina), q: busqueda, estado, orden })
        const res = await fetch(`/api/evaluaciones-candidatos?${params}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar la lista')
        setLista(data)
    }, [pagina, busqueda, estado, orden])
    useEffect(() => { void cargar().catch(e => setError(e.message)) }, [cargar])

    async function abrir(id: string) {
        const res = await fetch(`/api/evaluaciones-candidatos/${id}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo abrir el candidato')
        setDetalle(data)
        setEdicion({ nombre: data.nombre, apellido: data.apellido, telefono: data.telefono || '', email: data.email || '', observaciones: data.observaciones || '' })
        setEnlace('')
    }
    async function enviar(url: string, method: string, body?: unknown) {
        const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación')
        return data
    }
    async function ejecutar(tarea: () => Promise<void>) {
        setOcupado(true); setError(''); setMensaje('')
        try { await tarea() } catch (e) { setError(e instanceof Error ? e.message : 'Ocurrió un error') }
        finally { setOcupado(false) }
    }
    const ruta = detalle ? `/api/evaluaciones-candidatos/${detalle.id}` : ''
    const input = (clave: keyof typeof vacio, titulo: string, datos: typeof vacio, cambiar: (v: typeof vacio) => void, tipo = 'text') => <label key={clave}>{titulo}<input type={tipo} maxLength={clave === 'observaciones' ? 4000 : clave === 'email' ? 254 : clave === 'telefono' ? 40 : 80} value={datos[clave]} onChange={e => cambiar({ ...datos, [clave]: e.target.value })} /></label>

    return <div className={styles.page}>
        <header className={styles.header}><span className={styles.eyebrow}>PERSONAL · SELECCIÓN</span><h1>Evaluación de candidatos</h1><p>Pruebas prácticas, invitaciones y seguimiento de respuestas.</p></header>
        {error && <p role="alert" className={styles.error}>{error}</p>}{mensaje && <p role="status" className={styles.success}>{mensaje}</p>}
        <Configuracion /><div className={extra.metrics}>{[['total', 'Candidatos'], ['pendientes', 'Invitaciones pendientes'], ['iniciadas', 'En progreso'], ['completadas', 'Completadas'], ['vencidas', 'Vencidas'], ['revocadas', 'Revocadas']].map(([key, label]) => <div className={styles.card} key={key}><strong>{lista?.resumen[key] ?? '—'}</strong><span>{label}</span></div>)}</div>
        <section className={styles.card}><h2>Agregar candidato</h2><div className={extra.grid}>{input('nombre', 'Nombre', form, setForm)}{input('apellido', 'Apellido', form, setForm)}{input('telefono', 'Teléfono (opcional)', form, setForm)}{input('email', 'Correo (opcional)', form, setForm, 'email')}</div><label>Observaciones internas<textarea maxLength={4000} rows={2} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></label><button className={styles.primary} disabled={ocupado || !form.nombre.trim() || !form.apellido.trim()} onClick={() => void ejecutar(async () => { const data = await enviar('/api/evaluaciones-candidatos', 'POST', form); setForm(vacio); await cargar(); await abrir(data.id); setMensaje('Candidato creado.') })}>Crear candidato</button></section>
        <section className={styles.card}><h2>Candidatos</h2><form className={styles.invite} onSubmit={e => { e.preventDefault(); setPagina(1); setBusqueda(q) }}><label>Buscar por nombre<input value={q} onChange={e => setQ(e.target.value)} /></label><button type="submit">Buscar</button><label>Estado<select value={estado} onChange={e => { setPagina(1); setEstado(e.target.value) }}><option value="">Todos</option>{['PENDIENTE', 'UTILIZADA', 'VENCIDA', 'REVOCADA', 'EN_PROGRESO', 'COMPLETADO'].map(v => <option key={v} value={v}>{nombreEstado[v]}</option>)}</select></label><label>Orden<select value={orden} onChange={e => { setPagina(1); setOrden(e.target.value) }}><option value="recientes">Más recientes</option><option value="nombre">Apellido y nombre</option></select></label></form>
            {!lista ? <p>Cargando…</p> : lista.candidatos.length ? <><div className={styles.tableWrap}><table><thead><tr><th>Candidato</th><th>Contacto</th><th>Invitación</th><th>Evaluación</th><th>Invitación creada</th><th>Inicio</th><th>Fin</th><th>Resultado</th><th>Acciones</th></tr></thead><tbody>{lista.candidatos.map(c => <tr key={c.id}><td><strong>{c.apellido}, {c.nombre}</strong></td><td>{c.telefono || c.email || '—'}{c.telefono && c.email && <small>{c.email}</small>}</td><td>{c.invitacionEstado ? nombreEstado[c.invitacionEstado] : 'Sin invitación'}</td><td>{c.intentoEstado ? nombreEstado[c.intentoEstado] : 'No iniciada'}</td><td>{fecha(c.invitacionAt)}</td><td>{fecha(c.inicioAt)}</td><td>{fecha(c.finAt)}</td><td>Sin puntuación</td><td><button onClick={() => void ejecutar(() => abrir(c.id))}>Ver detalle</button></td></tr>)}</tbody></table></div><div className={extra.pager}><span>{lista.totalFiltrado} candidatos · página {pagina}</span><button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button><button disabled={pagina * lista.porPagina >= lista.totalFiltrado} onClick={() => setPagina(p => p + 1)}>Siguiente</button></div></> : <p>No hay candidatos para estos filtros.</p>}
        </section>
        {detalle && <section className={styles.card} id="detalle"><div className={styles.detailHead}><div><span className={styles.eyebrow}>FICHA DEL CANDIDATO</span><button onClick={() => { const porcentaje = Number(window.prompt("Tiempo para futuros intentos: porcentaje entre 100 y 300", "100")); if (porcentaje) void ejecutar(async () => { await enviar(ruta, "PATCH", { accion: "tiempo", porcentaje }); setMensaje("Ajuste guardado para futuros intentos.") }) }}>Ajustar tiempo individual</button><h2>{detalle.apellido}, {detalle.nombre}</h2><p>Alta: {fecha(detalle.createdAt)}</p></div><button onClick={() => { setDetalle(null); setEnlace('') }}>Cerrar</button></div>
            <div className={extra.grid}>{input('nombre', 'Nombre', edicion, setEdicion)}{input('apellido', 'Apellido', edicion, setEdicion)}{input('telefono', 'Teléfono', edicion, setEdicion)}{input('email', 'Correo', edicion, setEdicion, 'email')}</div><label>Observaciones internas<textarea rows={3} maxLength={4000} value={edicion.observaciones} onChange={e => setEdicion({ ...edicion, observaciones: e.target.value })} /></label><div className={extra.actions}><button className={styles.primary} disabled={ocupado} onClick={() => void ejecutar(async () => { await enviar(ruta, 'PATCH', edicion); await abrir(detalle.id); await cargar(); setMensaje('Datos guardados.') })}>Guardar datos</button><button className={styles.danger} disabled={ocupado} onClick={() => { if (window.confirm('¿Archivar este candidato y conservar su historial?')) void ejecutar(async () => { await enviar(ruta, 'PATCH', { accion: 'archivar' }); setDetalle(null); await cargar(); setMensaje('Candidato archivado.') }) }}>Archivar</button></div>
            <div className={styles.answer}><h3>Invitaciones</h3><button className={styles.primary} disabled={ocupado} onClick={() => void ejecutar(async () => { const data = await enviar(`${ruta}/invitaciones`, 'POST'); setEnlace(`${window.location.origin}/evaluacion/${data.token}`); await abrir(detalle.id); setEnlace(`${window.location.origin}/evaluacion/${data.token}`); await cargar(); setMensaje('Invitación creada. Copiá el enlace ahora.') })}>Generar invitación</button>{enlace && <div className={styles.linkBox}><strong>Enlace disponible sólo ahora</strong><input readOnly value={enlace} aria-label="Enlace de invitación" onFocus={e => e.target.select()} /><button onClick={() => void ejecutar(async () => { await navigator.clipboard.writeText(enlace); setMensaje('Enlace copiado.') })}>Copiar enlace</button><small>El token no se conserva en texto plano. Para obtener otro enlace, revocá éste y generá uno nuevo.</small></div>}
                {detalle.invitaciones.length ? <div className={styles.tableWrap}><table><thead><tr><th>Creada</th><th>Estado</th><th>Vence</th><th>Usada</th><th>Revocada</th><th>Acción</th></tr></thead><tbody>{detalle.invitaciones.map(i => <tr key={i.id}><td>{fecha(i.createdAt)}</td><td>{nombreEstado[i.estado]}</td><td>{fecha(i.venceAt)}</td><td>{fecha(i.intento?.inicioAt || null)}</td><td>{fecha(i.revocadaAt)}</td><td>{!i.revocadaAt && <button className={styles.danger} disabled={ocupado} onClick={() => { if (window.confirm('¿Revocar el enlace? El candidato perderá acceso inmediatamente, incluso si comenzó.')) void ejecutar(async () => { await enviar(`${ruta}/invitaciones/${i.id}`, 'PATCH'); await abrir(detalle.id); await cargar(); setMensaje('Invitación revocada.') }) }}>Revocar</button>}</td></tr>)}</tbody></table></div> : <p>Aún no hay invitaciones.</p>}</div>
            <div className={styles.answer}><h3>Historial de evaluaciones</h3>{detalle.invitaciones.filter(i => i.intento).length ? detalle.invitaciones.filter(i => i.intento).map(i => <div className={extra.attempt} key={i.id}><strong>{i.intento!.plan ? "Evaluación práctica — sin puntaje global" : "Evaluación de demostración — sin puntuación"}</strong>{i.intento!.plan && <RevisionPractica candidatoId={detalle.id} intento={i.intento!} />}<p>Estado: {nombreEstado[i.intento!.estado]} · Inicio: {fecha(i.intento!.inicioAt)} · Fin: {fecha(i.intento!.finAt)}</p>{i.intento!.finAt && <p>Duración: {Math.max(0, Math.round((new Date(i.intento!.finAt).getTime() - new Date(i.intento!.inicioAt).getTime()) / 60000))} minutos</p>}{!i.intento!.plan && i.intento!.respuestas.map(r => <div key={r.modulo}><strong>{r.modulo === 'DEMO' ? 'Demo — sin calificación' : r.modulo}</strong><p className={styles.pre}>{r.datos.texto || 'Sin texto'}</p></div>)}<p>Resultado global: pendiente de la Etapa 3.</p></div>) : <p>Aún no hay intentos.</p>}</div>
        </section>}
    </div>
}
