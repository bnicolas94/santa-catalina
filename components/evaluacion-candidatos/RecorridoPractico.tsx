'use client'
import { useEffect, useRef, useState } from 'react'
import { NOMBRES, type EstadoPractica, type Respuesta } from '@/lib/evaluacion-candidatos/tipos'
import { tiempoActivo } from '@/lib/evaluacion-candidatos/motor'
import Ejercicios from './Ejercicios'
import PlanillaSimulada from './PlanillaSimulada'
import styles from './practicas.module.css'
import GuiaModulo from './GuiaModulo'
export default function RecorridoPractico({ token }: { token: string }) {
    const [estado, setEstado] = useState<EstadoPractica | null>(null), [respuesta, setRespuesta] = useState<Respuesta | null>(null)
    const [tomada, setTomada] = useState(false), [guardado, setGuardado] = useState('Sin cambios pendientes'), [error, setError] = useState(''), [reloj, setReloj] = useState(0)
    const [cerrando, setCerrando] = useState(false)
    const [practica, setPractica] = useState([['Ejemplo', '2'], ['', '']])
    const lease = useRef(''), datos = useRef<EstadoPractica | null>(null), borrador = useRef<Respuesta | null>(null), dirty = useRef(false), busy = useRef(false), offset = useRef(0), ultimoCambio = useRef(0), ultimoLatido = useRef(0), reintento = useRef(0), tick = useRef<() => void>(() => {})
    const actual = estado?.plan.modulos.find(a => !estado.sesiones[a.modulo]?.fin)
    const sesion = actual && estado?.sesiones[actual.modulo]
    function adoptar(data: EstadoPractica, hidratar: boolean) {
        const previo = datos.current?.plan.modulos.find(a => !datos.current?.sesiones[a.modulo]?.fin)?.modulo
        const siguiente = data.plan.modulos.find(a => !data.sesiones[a.modulo]?.fin)?.modulo
        if (previo !== siguiente) hidratar = true
        datos.current = data; setEstado(data); offset.current = Date.parse(data.ahora) - Date.now()
        if (hidratar) { const a = data.plan.modulos.find(a => !data.sesiones[a.modulo]?.fin); const r = a ? data.sesiones[a.modulo]?.respuesta ?? null : null; borrador.current = r; setRespuesta(r); dirty.current = false }
    }
    async function api(body: Record<string, unknown>) {
        const res = await fetch(`/api/evaluacion/${token}/sesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, lease: lease.current }), cache: 'no-store' })
        const data = await res.json(); if (!res.ok) throw new Error(data.error || 'No se pudo guardar'); return data as EstadoPractica
    }
    useEffect(() => {
        lease.current ||= Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
        void api({ accion: 'tomar' }).then(d => { adoptar(d, true); setTomada(true) }).catch(async e => {
            setError(e.message)
            try { adoptar(await api({ accion: 'leer' }), true) } catch { /* Se conserva el error de acceso. */ }
        })
        const timer = setInterval(() => tick.current(), 500)
        return () => clearInterval(timer)
        // La credencial de sesión es exclusiva de esta carga de página.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
    async function guardar(cerrar = false) {
        const d = datos.current, a = d?.plan.modulos.find(a => !d.sesiones[a.modulo]?.fin), s = a && d?.sesiones[a.modulo]
        if (busy.current || !a || !s || !borrador.current) return
        const enviado = borrador.current; busy.current = true; setCerrando(cerrar); setGuardado('Guardando…')
        try {
            const nuevo = await api({ accion: cerrar ? 'cerrar' : 'guardar', modulo: a.modulo, revision: s.revision, respuesta: enviado })
            const finalizo = !!nuevo.sesiones[a.modulo]?.fin
            adoptar(nuevo, finalizo); if (borrador.current === enviado) dirty.current = false
            setGuardado(dirty.current ? 'Cambios pendientes' : 'Guardado'); setError('')
        } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar'); setGuardado('Error al guardar; conservá esta página abierta'); reintento.current = Date.now() + 5000 }
        finally { busy.current = false; setCerrando(false) }
    }
    tick.current = () => {
        setReloj(Date.now())
        if (!tomada || busy.current) return
        const d = datos.current, a = d?.plan.modulos.find(a => !d.sesiones[a.modulo]?.fin), s = a && d?.sesiones[a.modulo]
        if (s && !s.pausa && Date.now() > reintento.current && ((dirty.current && Date.now() - ultimoCambio.current > 800) || tiempoActivo(s, Date.now() + offset.current) >= a!.segundos * 1000)) { void guardar(); return }
        if (Date.now() - ultimoLatido.current > 10000) {
            ultimoLatido.current = Date.now(); busy.current = true
            void api({ accion: 'latido' }).then(d => adoptar(d, false)).catch(e => setError(e.message)).finally(() => { busy.current = false })
        }
    }
    function cambiar(r: Respuesta) { borrador.current = r; setRespuesta(r); dirty.current = true; ultimoCambio.current = Date.now(); setGuardado('Cambios pendientes') }
    const restante = actual && sesion ? Math.max(0, Math.ceil((actual.segundos * 1000 - tiempoActivo(sesion, (reloj || Date.now()) + offset.current)) / 1000)) : actual?.segundos ?? 0
    return <main className={styles.page}><h1>Evaluación de habilidades administrativas</h1>{error && <p className={styles.error} role="alert">{error}</p>}{!estado && <p>Cargando evaluación…</p>}{estado && <>
        <section className={styles.card}><h2>Tu recorrido de evaluación</h2><p>Estas son las pruebas de tu invitación. Cada una tiene sus propias instrucciones y se inicia por separado.</p><ol>{estado.plan.modulos.map(a => <li key={a.modulo}><strong>{NOMBRES[a.modulo]}</strong> · {Math.round(a.segundos / 60 * 10) / 10} minutos · {estado.sesiones[a.modulo]?.fin ? 'Completada' : estado.sesiones[a.modulo] ? 'En curso' : a.modulo === actual?.modulo ? 'Lista para comenzar' : 'Pendiente'}</li>)}</ol></section>
        <div className={styles.toolbar}><strong>{actual ? NOMBRES[actual.modulo] : 'Evaluación finalizada'} · {estado.plan.modulos.filter(a => estado.sesiones[a.modulo]?.fin).length}/{estado.plan.modulos.length}</strong><span>{sesion ? 'Tiempo restante' : 'Tiempo disponible'}: {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</span><span role="status">{guardado}</span></div>
        {!actual ? <section className={styles.card}><h2>Respuestas recibidas</h2><p>La evaluación quedó finalizada. El equipo de selección revisará tus respuestas.</p></section> : !tomada ? <section className={styles.card}><p>Para continuar, recuperá la sesión. Si recargaste la página, puede ser necesario esperar hasta 45 segundos. El reloj de un módulo iniciado continúa durante una desconexión.</p><button onClick={() => { busy.current = true; void api({ accion: 'tomar' }).then(d => { adoptar(d, true); setTomada(true); setError('') }).catch(e => setError(e.message)).finally(() => { busy.current = false }) }}>Recuperar sesión</button></section> : !sesion ? <section className={styles.card}><h2>{NOMBRES[actual.modulo]}</h2><GuiaModulo modulo={actual.modulo} /><p>Disponés de {actual.segundos / 60} minutos desde el inicio explícito. El guardado es automático. El reloj continúa si se corta la conexión; tenés 60 segundos de tolerancia para entregar. Si la falla dura más, contactá a Personal para autorizar una reanudación.</p><details><summary>Familiarización sin puntuación</summary><p>Probá editar celdas y moverte con Tab o Enter.</p><PlanillaSimulada columnas={[{ nombre: 'Artículo' }, { nombre: 'Cantidad', tipo: 'numero' }]} filas={practica} cambiar={setPractica} cambiarVista={() => {}} /></details><button onClick={() => { busy.current = true; void api({ accion: 'iniciar', modulo: actual.modulo }).then(d => adoptar(d, true)).catch(e => setError(e.message)).finally(() => { busy.current = false }) }}>Comenzar {NOMBRES[actual.modulo].toLocaleLowerCase("es")}</button></section> : sesion.pausa ? <p className={styles.card}>Personal pausó este módulo. El reloj está detenido. Esperá la reanudación.</p> : respuesta && <section className={styles.card}><details><summary>Ver instrucciones de esta prueba</summary><GuiaModulo modulo={actual.modulo} /></details><fieldset disabled={restante === 0 || cerrando} style={{ border: 0, padding: 0, minWidth: 0 }}><Ejercicios key={actual.modulo} asignacion={actual} respuesta={respuesta} cambiar={cambiar} /></fieldset><div className={styles.actions}><button disabled={guardado === "Guardando…"} onClick={() => void guardar()}>Reintentar guardado</button><button disabled={guardado === "Guardando…"} onClick={() => { if (window.confirm('¿Finalizar este módulo? Se guardará el estado actual y quedará bloqueado.')) void guardar(true) }}>Guardar y continuar</button></div></section>}
    </>}</main>
}
