'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import type { AccionFichadoRemoto, EstadoFichadoRemoto } from '@/lib/rrhh/fichado-remoto'
import { resumirJornadaRemota } from '@/lib/rrhh/resumen-jornada-remota'
import styles from './page.module.css'

type Marca = { id: string; fechaHora: string; tipo: string; origen: string }
type Jornada = { fecha: string; nombre: string; estado: EstadoFichadoRemoto; marcas: Marca[]; horasEfectivas: number; horasEsperadas: number; horarioPrevisto: { entrada: string | null; salida: string | null } | null; horarioEntradaComputable: string | null; ahoraServidor: string }

const botones: Record<EstadoFichadoRemoto, Array<{ accion: AccionFichadoRemoto; texto: string }>> = {
    sin_iniciar: [{ accion: 'entrada', texto: 'Fichar entrada' }],
    trabajando: [{ accion: 'inicio_descanso', texto: 'Iniciar descanso' }, { accion: 'salida', texto: 'Fichar salida' }],
    descansando: [{ accion: 'fin_descanso', texto: 'Terminar descanso' }],
    finalizado: [],
}

const estados: Record<EstadoFichadoRemoto, string> = {
    sin_iniciar: 'Jornada sin iniciar', trabajando: 'Trabajando', descansando: 'En descanso', finalizado: 'Jornada finalizada',
}

const etiquetas: Record<string, string> = {
    remoto_entrada: 'Entrada', remoto_inicio_descanso: 'Inicio del descanso',
    remoto_fin_descanso: 'Fin del descanso', remoto_salida: 'Salida',
}

function horaArgentina(fecha: string) {
    return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Buenos_Aires', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(fecha))
}

function minutosLegibles(minutos: number) {
    return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`
}

export default function MiFichadoPage() {
    const [jornada, setJornada] = useState<Jornada | null>(null)
    const [error, setError] = useState('')
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [sincronizadoEn, setSincronizadoEn] = useState(0)
    const [ahoraLocal, setAhoraLocal] = useState(0)
    const ultimaConsulta = useRef(0)

    const actualizar = useCallback(async () => {
        const consulta = ++ultimaConsulta.current
        try {
            const res = await fetch('/api/mi-fichado', { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo consultar la jornada.')
            if (consulta !== ultimaConsulta.current) return
            const recibidoEn = performance.now()
            setJornada(data)
            setSincronizadoEn(recibidoEn)
            setAhoraLocal(recibidoEn)
            setError('')
        } catch (e) {
            if (consulta === ultimaConsulta.current) {
                setJornada(null)
                setError(e instanceof Error ? e.message : 'No se pudo consultar la jornada.')
            }
        } finally { if (consulta === ultimaConsulta.current) setCargando(false) }
    }, [])

    useEffect(() => { void actualizar() }, [actualizar])
    useEffect(() => {
        const reloj = window.setInterval(() => setAhoraLocal(performance.now()), 1000)
        return () => window.clearInterval(reloj)
    }, [])
    useEffect(() => {
        if (!jornada) return
        const refresco = window.setInterval(() => { void actualizar() }, 30_000)
        const alVolver = () => { void actualizar() }
        window.addEventListener('focus', alVolver)
        return () => { window.clearInterval(refresco); window.removeEventListener('focus', alVolver) }
    }, [actualizar, jornada])

    const resumen = jornada && sincronizadoEn
        ? resumirJornadaRemota(
            jornada.marcas,
            new Date(new Date(jornada.ahoraServidor).getTime() + Math.max(0, ahoraLocal - sincronizadoEn)),
            jornada.horasEsperadas,
            jornada.horarioEntradaComputable,
        )
        : null

    async function fichar(accion: AccionFichadoRemoto) {
        setGuardando(true)
        setError('')
        try {
            const res = await fetch('/api/mi-fichado', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar la fichada.')
            await actualizar()
        } catch (e) {
            const mensaje = e instanceof Error ? e.message : 'No se pudo guardar la fichada.'
            await actualizar()
            setError(mensaje)
        } finally { setGuardando(false) }
    }

    return <main className={styles.page}>
        <section className={styles.card}>
            <div className={styles.topline}><span>Santa Catalina</span><button type="button" onClick={() => signOut({ callbackUrl: '/login' })}>Salir</button></div>
            <h1>Mi fichado</h1>
            <p className={styles.intro}>Registrá tu entrada, salida y descansos de home office. La hora se toma del servidor.</p>
            {cargando && <p>Cargando jornada…</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {jornada && resumen && <>
                <div className={styles.status}><span>{jornada.fecha} · Argentina</span><strong>{estados[jornada.estado]}</strong></div>
                <div className={styles.metrics}>
                    <div className={styles.metricMain}><span>Tiempo efectivamente trabajado</span><strong>{minutosLegibles(resumen.minutosEfectivosActuales)}</strong></div>
                    <div className={styles.metric}><span>Descansos acumulados</span><strong>{minutosLegibles(resumen.minutosDescanso)}</strong></div>
                    <div className={styles.metric}><span>Para completar la jornada</span><strong>{minutosLegibles(resumen.minutosRestantes)}</strong></div>
                </div>
                <div className={styles.progress} role="progressbar" aria-label="Progreso de la jornada" aria-valuemin={0} aria-valuemax={resumen.minutosMeta} aria-valuenow={Math.min(resumen.minutosMeta, resumen.minutosEfectivosActuales)}><div style={{ width: `${resumen.minutosMeta > 0 ? Math.min(100, resumen.minutosEfectivosActuales / resumen.minutosMeta * 100) : 0}%` }} /></div>
                <p className={styles.hoursNote}>Jornada prevista: {minutosLegibles(resumen.minutosMeta)}{jornada.horarioPrevisto?.entrada && jornada.horarioPrevisto.salida ? ` · ${jornada.horarioPrevisto.entrada} a ${jornada.horarioPrevisto.salida}` : ''}. {resumen.tramoTrabajoEnCurso ? 'El trabajo en curso se muestra en vivo y se confirma al fichar una pausa o la salida.' : resumen.descansoEnCurso ? 'El descanso actual sigue acumulándose hasta que fiches su fin.' : 'El total confirmado se usa para la liquidación.'}</p>
                <div className={styles.actions}>{botones[jornada.estado].map(boton =>
                    <button key={boton.accion} type="button" disabled={guardando} onClick={() => fichar(boton.accion)}>{guardando ? 'Guardando…' : boton.texto}</button>
                )}</div>
                {jornada.estado === 'finalizado' && <p>La jornada de hoy ya terminó.</p>}
                <h2>Movimientos de hoy</h2>
                {jornada.marcas.length === 0 ? <p>Todavía no hay fichadas.</p> : <ol className={styles.history}>{jornada.marcas.map(marca =>
                    <li key={marca.id}><span>{etiquetas[marca.origen] || (marca.tipo === 'entrada' ? 'Entrada' : 'Salida')}</span><time dateTime={marca.fechaHora}>{horaArgentina(marca.fechaHora)}</time></li>
                )}</ol>}
                <button type="button" className={styles.refresh} onClick={() => void actualizar()}>Actualizar estado</button>
            </>}
        </section>
    </main>
}
