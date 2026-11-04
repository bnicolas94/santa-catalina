'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import styles from '../../prueba/[token]/page.module.css'
import extra from './page.module.css'
import RecorridoPractico from '@/components/evaluacion-candidatos/RecorridoPractico'

type Estado = { version: number; nombre: string; estado: string; inicioAt: string | null; finAt: string | null; texto: string }

export default function EvaluacionPage() {
    const { token } = useParams<{ token: string }>()
    const [datos, setDatos] = useState<Estado | null>(null)
    const [texto, setTexto] = useState('')
    const [acepta, setAcepta] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')

    useEffect(() => {
        fetch(`/api/evaluacion/${token}`, { cache: 'no-store' }).then(async res => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'El enlace no está disponible')
            setDatos(data); setTexto(data.texto)
        }).catch(e => setError(e instanceof Error ? e.message : 'No se pudo abrir la evaluación')).finally(() => setCargando(false))
    }, [token])

    async function operar(method: 'POST' | 'PATCH' | 'PUT', body?: unknown) {
        setOcupado(true); setError(''); setMensaje('')
        try {
            const res = await fetch(`/api/evaluacion/${token}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
            setDatos(v => v ? { ...v, ...data } : v)
            if (method === 'PATCH') setMensaje('Progreso guardado. Podés recargar la página para comprobarlo.')
            if (method === 'POST') setMensaje('Evaluación iniciada.')
            if (method === 'PUT') setMensaje('Demostración finalizada.')
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación') }
        finally { setOcupado(false) }
    }

    if (datos?.version === 2 && datos.estado !== 'NO_INICIADO') return <RecorridoPractico token={token} />
    return <main className={styles.page}>
        <header className={styles.header}><span className={styles.brand}>SANTA CATALINA</span><h1>Evaluación de habilidades administrativas</h1><p>Pruebas prácticas para tareas de atención y administración.</p></header>
        {cargando && <p>Cargando invitación…</p>}{error && <p className={styles.error} role="alert">{error}</p>}{mensaje && <p className={extra.success} role="status">{mensaje}</p>}
        {datos?.estado === 'NO_INICIADO' && <section className={styles.card}><h2>Hola, {datos.nombre}</h2><p>Se evaluarán tipeo, uso de planillas, interpretación de conversaciones, atención al detalle y comunicación con clientes.</p><p>La evaluación final durará aproximadamente 25 a 30 minutos. Vas a completar cinco módulos con guardado automático y tiempos definidos al comenzar cada módulo. No hay una puntuación global de contratación. Recomendamos usar una computadora con teclado.</p><h3>Condiciones de uso</h3><p>Los ejercicios se utilizarán para evaluar competencias laborales. El equipo de selección podrá revisar tus respuestas y tiempos. Los casos son ficticios y participar no garantiza una contratación.</p><label className={extra.check}><input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} /> Leí y acepto estas condiciones.</label><button className={styles.primary} disabled={!acepta || ocupado} onClick={() => void operar('POST', { acepta: true })}>Comenzar evaluación</button></section>}
        {datos?.estado === 'EN_PROGRESO' && <section className={styles.card}><span className={styles.step}>DEMO — SIN CALIFICACIÓN</span><h2>Probá cómo se guarda tu progreso</h2><p>Escribí un texto ficticio y guardalo. Después podés recargar esta página y recuperarlo.</p><label htmlFor="texto-demo">Texto de demostración</label><textarea id="texto-demo" rows={7} maxLength={2000} value={texto} onChange={e => setTexto(e.target.value)} /><div className={extra.actions}><button className={styles.primary} disabled={ocupado} onClick={() => void operar('PATCH', { texto })}>Guardar progreso</button><button disabled={ocupado} onClick={() => { if (window.confirm('¿Finalizar la demostración? Después no podrás modificar el texto.')) void operar('PUT', { texto }) }}>Finalizar demostración</button></div><p className={extra.note}>Al finalizar, el texto actual se guarda junto con el cierre del intento.</p></section>}
        {datos?.estado === 'COMPLETADO' && <section className={styles.card}><h2>Demostración finalizada</h2><p>Tu intento quedó registrado. Gracias por participar.</p><p>Esta demostración no tiene puntuación. El equipo de selección podrá consultar el texto guardado.</p></section>}
    </main>
}
