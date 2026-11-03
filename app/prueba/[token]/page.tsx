'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CAMPOS_PEDIDO, CASOS_WHATSAPP, DURACION_MINUTOS, PEDIDOS, TEXTO_TIPEO, type Respuestas } from '@/lib/postulaciones/prueba'
import styles from './page.module.css'

type Estado = { nombre: string; estado: 'pendiente' | 'iniciada' | 'entregada' | 'agotada' | 'vencida' | 'anulada'; limiteAt: string | null }
const vacias = (): Respuestas => ({ tipeo: '', whatsapp: CASOS_WHATSAPP.map(() => ''), pedidos: PEDIDOS.map(() => Object.fromEntries(CAMPOS_PEDIDO.map(c => [c, ''])) as Respuestas['pedidos'][number]), rutas: '', criterio: '' })

export default function PruebaPage() {
    const { token } = useParams<{ token: string }>()
    const [estado, setEstado] = useState<Estado | null>(null)
    const [respuestas, setRespuestas] = useState<Respuestas>(vacias)
    const [error, setError] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        const draft = localStorage.getItem(`prueba:${token}`)
        if (draft) { try { setRespuestas({ ...vacias(), ...JSON.parse(draft) }) } catch { /* borrador ilegible */ } }
        fetch(`/api/prueba/${token}`, { cache: 'no-store' }).then(async res => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo abrir la prueba')
            setEstado(data)
        }).catch(err => setError(err.message))
    }, [token])
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])
    useEffect(() => {
        if (estado?.estado === 'iniciada') localStorage.setItem(`prueba:${token}`, JSON.stringify(respuestas))
    }, [respuestas, estado?.estado, token])

    async function iniciar() {
        setEnviando(true); setError('')
        try {
            const res = await fetch(`/api/prueba/${token}`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo iniciar')
            setEstado(data)
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar') }
        finally { setEnviando(false) }
    }
    async function entregar() {
        if (!window.confirm('¿Entregar la prueba? Después no vas a poder modificar tus respuestas.')) return
        setEnviando(true); setError('')
        try {
            const res = await fetch(`/api/prueba/${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(respuestas) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo entregar')
            localStorage.removeItem(`prueba:${token}`)
            setEstado(prev => prev ? { ...prev, estado: 'entregada' } : prev)
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo entregar') }
        finally { setEnviando(false) }
    }
    const restante = estado?.limiteAt ? Math.max(0, Math.ceil((new Date(estado.limiteAt).getTime() - now) / 1000)) : 0
    const minutos = String(Math.floor(restante / 60)).padStart(2, '0')
    const segundos = String(restante % 60).padStart(2, '0')
    const activa = estado?.estado === 'iniciada' && restante > 0

    return <main className={styles.page}>
        <header className={styles.header}><span className={styles.brand}>SANTA CATALINA</span><h1>Prueba para el área administrativa</h1><p>Una simulación breve de las tareas habituales del puesto.</p></header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!estado && !error && <p>Cargando prueba…</p>}
        {estado?.estado === 'pendiente' && <section className={styles.card}>
            <h2>Hola, {estado.nombre}</h2>
            <p>Vas a responder mensajes de clientes, cargar pedidos, organizar entregas y resolver un imprevisto. Los datos son ficticios; no se enviará ningún mensaje ni se modificará ningún pedido real.</p>
            <p>Tenés <strong>{DURACION_MINUTOS} minutos</strong> desde que inicies. Prepará un lugar tranquilo y una computadora. El borrador se guarda en este navegador mientras trabajás.</p>
            <button className={styles.primary} disabled={enviando} onClick={iniciar}>{enviando ? 'Iniciando…' : 'Iniciar prueba'}</button>
        </section>}
        {estado?.estado === 'entregada' && <section className={styles.card}><h2>Prueba entregada</h2><p>Recibimos tus respuestas. Gracias por tu tiempo.</p></section>}
        {estado && ['agotada', 'vencida', 'anulada'].includes(estado.estado) && <section className={styles.card}><h2>Este enlace ya no está disponible</h2><p>Contactá a la persona que te invitó si necesitás ayuda.</p></section>}
        {estado?.estado === 'iniciada' && <>
            <div className={styles.timer} aria-live="off">Tiempo restante: <strong>{minutos}:{segundos}</strong></div>
            {!activa && <p className={styles.error}>Se terminó el tiempo de esta prueba.</p>}
            <fieldset disabled={!activa || enviando} className={styles.form}>
                <section className={styles.card}><span className={styles.step}>01 · TIPEO</span><h2>Transcribí este mensaje</h2><p>Copialo con la mayor precisión posible. Revisá números, presentación y horario.</p><blockquote>{TEXTO_TIPEO}</blockquote><textarea aria-label="Transcripción" value={respuestas.tipeo} onChange={e => setRespuestas(v => ({ ...v, tipeo: e.target.value }))} rows={4} /></section>
                <section className={styles.card}><span className={styles.step}>02 · ATENCIÓN</span><h2>Respondé por WhatsApp</h2><p>Escribí lo que le enviarías a cada cliente. Si falta información, pedila antes de confirmar.</p>{CASOS_WHATSAPP.map((caso, i) => <div className={styles.case} key={caso.titulo}><h3>{caso.titulo}</h3><blockquote>{caso.mensaje}</blockquote><textarea aria-label={`Respuesta a ${caso.titulo}`} value={respuestas.whatsapp[i]} onChange={e => setRespuestas(v => ({ ...v, whatsapp: v.whatsapp.map((x, n) => n === i ? e.target.value : x) }))} rows={4} /></div>)}</section>
                <section className={styles.card}><span className={styles.step}>03 · PEDIDOS</span><h2>Cargá los pedidos</h2><p>Usá una fila por chat. Para datos faltantes, escribí “pendiente” en el campo correspondiente y explicá el estado. Fecha: hoy o mañana según el mensaje.</p>{PEDIDOS.map((pedido, i) => <div className={styles.case} key={pedido.id}><h3>Pedido {pedido.id}</h3><blockquote>{pedido.chat}</blockquote><div className={styles.grid}>{CAMPOS_PEDIDO.map(campo => <label key={campo}>{campo === 'estado' ? 'Estado / observación' : campo.charAt(0).toUpperCase() + campo.slice(1)}<input value={respuestas.pedidos[i][campo]} onChange={e => setRespuestas(v => ({ ...v, pedidos: v.pedidos.map((row, n) => n === i ? { ...row, [campo]: e.target.value } : row) }))} /></label>)}</div></div>)}</section>
                <section className={styles.card}><span className={styles.step}>04 · RUTAS</span><h2>Organizá las entregas</h2><p>Asigná estas cinco entregas y explicá el orden. El móvil 1 cubre Centro y Sur (hasta 5 paquetes por viaje); el móvil 2 cubre Norte y Sur (hasta 4 paquetes por viaje). Los móviles pueden hacer otro viaje por la tarde.</p><ul><li>R1 · Centro · 2 paquetes · 10:00–12:00</li><li>R2 · Norte · 1 paquete · 10:00–12:00</li><li>R3 · Sur · 3 paquetes · 11:00–13:00</li><li>R4 · Centro · 2 paquetes · 10:00–12:00</li><li>R5 · Sur · 1 paquete · 14:00–16:00</li></ul><p>Si ves un conflicto o te falta un dato para confirmar el recorrido, señalalo.</p><textarea aria-label="Organización de rutas" value={respuestas.rutas} onChange={e => setRespuestas(v => ({ ...v, rutas: e.target.value }))} rows={7} /></section>
                <section className={styles.card}><span className={styles.step}>05 · CRITERIO</span><h2>Un imprevisto</h2><p>Mientras cargás pedidos, Eva solicita entrega urgente pero aún no informó la dirección. A la vez, Bruno cambia la cantidad cuando la ruta de hoy ya está preparada. ¿Qué hacés primero, qué verificás y a quién avisás?</p><textarea aria-label="Resolución del imprevisto" value={respuestas.criterio} onChange={e => setRespuestas(v => ({ ...v, criterio: e.target.value }))} rows={6} /></section>
                <button className={styles.primary} disabled={!activa || enviando} onClick={entregar}>{enviando ? 'Entregando…' : 'Entregar prueba'}</button>
            </fieldset>
        </>}
    </main>
}
