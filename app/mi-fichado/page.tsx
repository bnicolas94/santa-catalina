'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import type { AccionFichadoRemoto, EstadoFichadoRemoto } from '@/lib/rrhh/fichado-remoto'
import styles from './page.module.css'

type Marca = { id: string; fechaHora: string; tipo: string; origen: string }
type Jornada = { fecha: string; nombre: string; estado: EstadoFichadoRemoto; marcas: Marca[]; horasEfectivas: number; horasEsperadas: number; horarioPrevisto: { entrada: string | null; salida: string | null } | null }

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

function horasMinutos(horas: number) {
    const minutos = Math.round(horas * 60)
    return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`
}

export default function MiFichadoPage() {
    const [jornada, setJornada] = useState<Jornada | null>(null)
    const [error, setError] = useState('')
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)

    const actualizar = useCallback(async () => {
        try {
            const res = await fetch('/api/mi-fichado', { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo consultar la jornada.')
            setJornada(data)
            setError('')
        } catch (e) { setJornada(null); setError(e instanceof Error ? e.message : 'No se pudo consultar la jornada.') }
        finally { setCargando(false) }
    }, [])

    useEffect(() => { void actualizar() }, [actualizar])

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
            {jornada && <>
                <div className={styles.status}><span>{jornada.fecha} · Argentina</span><strong>{estados[jornada.estado]}</strong></div>
                <div className={styles.hours}><span>Trabajo efectivo registrado</span><strong>{horasMinutos(jornada.horasEfectivas)}</strong><small>Jornada prevista: {horasMinutos(jornada.horasEsperadas)}{jornada.horarioPrevisto?.entrada && jornada.horarioPrevisto.salida ? ` · ${jornada.horarioPrevisto.entrada} a ${jornada.horarioPrevisto.salida}` : ''}. El tramo en curso se suma al cerrar con una pausa o la salida.</small></div>
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
