'use client'

import { useEffect, useRef, useState } from 'react'
import { CONSULTAS_CLIENTES, FILAS_CONTROL, REGLAS_CLIENTES, TEXTO_TIPEO_V3, TIPEO_SEGUNDOS } from '@/lib/postulaciones/habilidades'
import { DURACION_MINUTOS } from '@/lib/postulaciones/prueba'
import styles from './page.module.css'

export type EstadoHabilidades = {
    nombre: string
    version: number
    estado: 'pendiente' | 'iniciada' | 'entregada' | 'agotada' | 'vencida' | 'anulada'
    limiteAt: string | null
    tipeoInicioAt?: string | null
    tipeoFinAt?: string | null
    tipeoTexto?: string | null
    planilla?: { nombreArchivo?: string; origenIntacto?: boolean } | null
}

export default function PruebaHabilidades({ token, initial }: { token: string; initial: EstadoHabilidades }) {
    const [estado, setEstado] = useState(initial)
    const [texto, setTexto] = useState(initial.tipeoTexto || '')
    const [errores, setErrores] = useState<Record<string, string>>({})
    const [clientes, setClientes] = useState<string[]>(CONSULTAS_CLIENTES.map(() => ''))
    const [now, setNow] = useState(Date.now())
    const [error, setError] = useState('')
    const [ocupado, setOcupado] = useState(false)
    const finalizando = useRef(false)

    useEffect(() => {
        const raw = localStorage.getItem(`prueba-habilidades:${token}`)
        if (!raw) return
        try {
            const saved = JSON.parse(raw) as { texto?: string; errores?: Record<string, string>; clientes?: string[] }
            if (typeof saved.texto === 'string' && !initial.tipeoFinAt) setTexto(saved.texto)
            if (saved.errores && typeof saved.errores === 'object') setErrores(saved.errores)
            if (Array.isArray(saved.clientes) && saved.clientes.length === CONSULTAS_CLIENTES.length) setClientes(saved.clientes)
        } catch { /* borrador ilegible */ }
    }, [token, initial.tipeoFinAt])
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])
    useEffect(() => {
        if (estado.estado === 'iniciada') localStorage.setItem(`prueba-habilidades:${token}`, JSON.stringify({ texto, errores, clientes }))
    }, [estado.estado, token, texto, errores, clientes])

    const finTipeoMs = estado.tipeoInicioAt ? new Date(estado.tipeoInicioAt).getTime() + TIPEO_SEGUNDOS * 1000 : null
    const restanteTipeo = finTipeoMs ? Math.max(0, Math.ceil((finTipeoMs - now) / 1000)) : TIPEO_SEGUNDOS
    const restanteTotal = estado.limiteAt ? Math.max(0, Math.ceil((new Date(estado.limiteAt).getTime() - now) / 1000)) : 0
    const activa = estado.estado === 'iniciada' && restanteTotal > 0
    const escribiendo = activa && !!estado.tipeoInicioAt && !estado.tipeoFinAt && restanteTipeo > 0
    const reloj = (segundos: number) => `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`

    useEffect(() => {
        if (!estado.tipeoInicioAt || estado.tipeoFinAt || !texto || !finTipeoMs || Date.now() >= finTipeoMs) return
        const timer = setTimeout(() => {
            void fetch(`/api/prueba/${token}/tipeo`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) }).catch(() => setError('Se interrumpió el guardado del tipeo. Revisá tu conexión.'))
        }, 500)
        return () => clearTimeout(timer)
    }, [estado.tipeoInicioAt, estado.tipeoFinAt, texto, token, finTipeoMs])

    useEffect(() => {
        if (!activa || !estado.tipeoInicioAt || estado.tipeoFinAt || restanteTipeo > 0 || finalizando.current) return
        finalizando.current = true
        void fetch(`/api/prueba/${token}/tipeo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) })
            .then(async res => {
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'No se pudo finalizar el tipeo')
                setEstado(prev => ({ ...prev, tipeoFinAt: data.tipeoFinAt, tipeoTexto: data.tipeoTexto }))
                setError('')
            }).catch(err => setError(err instanceof Error ? err.message : 'No se pudo finalizar el tipeo'))
            .finally(() => { finalizando.current = false })
    }, [activa, estado.tipeoInicioAt, estado.tipeoFinAt, restanteTipeo, token, texto])

    async function iniciar() {
        setOcupado(true); setError('')
        try {
            const res = await fetch(`/api/prueba/${token}`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo iniciar')
            setEstado(data)
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar') }
        finally { setOcupado(false) }
    }
    async function iniciarTipeo() {
        setOcupado(true); setError('')
        try {
            const res = await fetch(`/api/prueba/${token}/tipeo`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el tipeo')
            setEstado(prev => ({ ...prev, ...data }))
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar el tipeo') }
        finally { setOcupado(false) }
    }
    async function terminarTipeo() {
        setOcupado(true); setError('')
        try {
            const res = await fetch(`/api/prueba/${token}/tipeo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar el tipeo')
            setEstado(prev => ({ ...prev, tipeoFinAt: data.tipeoFinAt, tipeoTexto: data.tipeoTexto }))
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el tipeo') }
        finally { setOcupado(false) }
    }
    async function subirPlanilla(file: File | undefined) {
        if (!file) return
        if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 1_000_000) { setError('Elegí un archivo .xlsx de hasta 1 MB'); return }
        setOcupado(true); setError('')
        try {
            const query = new URLSearchParams({ nombre: file.name })
            const res = await fetch(`/api/prueba/${token}/planilla?${query}`, { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: file })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo leer la planilla')
            setEstado(prev => ({ ...prev, planilla: { nombreArchivo: data.nombreArchivo, origenIntacto: data.origenIntacto } }))
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo subir la planilla') }
        finally { setOcupado(false) }
    }
    async function entregar() {
        if (!window.confirm('¿Entregar la prueba? Después no vas a poder modificar las respuestas.')) return
        setOcupado(true); setError('')
        try {
            const body = { errores: Object.entries(errores).map(([id, correccion]) => ({ id, correccion })), clientes }
            const res = await fetch(`/api/prueba/${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo entregar')
            localStorage.removeItem(`prueba-habilidades:${token}`)
            setEstado(prev => ({ ...prev, estado: 'entregada' }))
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo entregar') }
        finally { setOcupado(false) }
    }

    return <main className={styles.page}>
        <header className={styles.header}><span className={styles.brand}>SANTA CATALINA</span><h1>Prueba de habilidades administrativas</h1><p>Tipeo, control de errores, planilla y atención escrita. Todas las reglas están en las consignas.</p></header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {estado.estado === 'pendiente' && <section className={styles.card}><h2>Hola, {estado.nombre}</h2><p>La prueba dura hasta {DURACION_MINUTOS} minutos. El ejercicio de tipeo tiene un reloj propio de 2 minutos que comienza cuando presiones «Iniciar tipeo». Podés usar Excel, LibreOffice o Google Sheets para la planilla. Los datos son ficticios.</p><p>Necesitás una computadora con teclado y una aplicación de planillas. Preparalas antes de iniciar.</p><button className={styles.primary} disabled={ocupado} onClick={iniciar}>Iniciar prueba</button></section>}
        {estado.estado === 'entregada' && <section className={styles.card}><h2>Prueba entregada</h2><p>Recibimos tus respuestas. Gracias por tu tiempo.</p></section>}
        {['agotada', 'vencida', 'anulada'].includes(estado.estado) && <section className={styles.card}><h2>Este enlace ya no está disponible</h2><p>Contactá a la persona que te invitó si necesitás ayuda.</p></section>}
        {estado.estado === 'iniciada' && <>
            <div className={styles.timer}>Tiempo total restante: <strong>{reloj(restanteTotal)}</strong></div>
            {!activa && <p className={styles.error}>Se terminó el tiempo de la prueba.</p>}
            <section className={styles.card}><span className={styles.step}>01 · TIPEO</span><h2>Velocidad y precisión</h2><p>Cuando inicies, copiá el texto exactamente como aparece. Tenés 2 minutos. El sistema guarda el avance; al terminar el tiempo cierra esta sección. Usá el teclado, sin pegar texto.</p>
                {!estado.tipeoInicioAt && <button className={styles.primary} disabled={!activa || ocupado} onClick={iniciarTipeo}>Iniciar tipeo · 2 minutos</button>}
                {estado.tipeoInicioAt && <><p><strong>Tiempo de tipeo: {reloj(restanteTipeo)}</strong></p><blockquote>{TEXTO_TIPEO_V3}</blockquote><textarea aria-label="Texto tipeado" rows={5} value={estado.tipeoFinAt ? estado.tipeoTexto || '' : texto} disabled={!escribiendo || ocupado} onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()} onChange={e => setTexto(e.target.value)} />{!estado.tipeoFinAt && restanteTipeo > 0 && <button className={styles.primary} disabled={!activa || ocupado} onClick={terminarTipeo}>Terminar tipeo</button>}{estado.tipeoFinAt && <p>Ejercicio de tipeo guardado.</p>}</>}
            </section>
            <fieldset className={styles.form} disabled={!activa || ocupado || !estado.tipeoFinAt}>
                <section className={styles.card}><span className={styles.step}>02 · CONTROL DE ERRORES</span><h2>Compará dos registros</h2><p>La columna «Original» es el dato correcto; «Cargado» es lo que alguien escribió. Marcá cada fila con alguna diferencia en nombre, artículo, cantidad, fecha o teléfono, y escribí la corrección. Si la fila coincide, dejala sin marcar. No hace falta conocer ningún producto ni procedimiento.</p><div className={styles.tableWrap}><table className={styles.compare}><thead><tr><th>Fila</th><th>Original</th><th>Cargado</th><th>¿Error?</th></tr></thead><tbody>{FILAS_CONTROL.map(fila => <tr key={fila.id}><th>{fila.id}</th><td>Nombre: {fila.original.nombre}<br />Artículo: {fila.original.articulo}<br />Cantidad: {fila.original.cantidad}<br />Fecha: {fila.original.fecha}<br />Teléfono: {fila.original.telefono}</td><td>Nombre: {fila.cargado.nombre}<br />Artículo: {fila.cargado.articulo}<br />Cantidad: {fila.cargado.cantidad}<br />Fecha: {fila.cargado.fecha}<br />Teléfono: {fila.cargado.telefono}</td><td><input type="checkbox" aria-label={`Marcar error en ${fila.id}`} checked={fila.id in errores} onChange={e => setErrores(prev => { const next = { ...prev }; if (e.target.checked) next[fila.id] = ''; else delete next[fila.id]; return next })} /></td></tr>)}</tbody></table></div>{FILAS_CONTROL.filter(fila => fila.id in errores).map(fila => <label className={styles.correction} key={fila.id}>Corrección de {fila.id}<input value={errores[fila.id]} maxLength={500} placeholder="Ejemplo: la cantidad correcta es 3" onChange={e => setErrores(prev => ({ ...prev, [fila.id]: e.target.value }))} /></label>)}</section>
                <section className={styles.card}><span className={styles.step}>03 · PLANILLA</span><h2>Trabajá con un archivo .xlsx</h2><p>Descargá la planilla. Sus instrucciones están en la primera hoja: completá totales con fórmulas y tres indicadores en «Resumen». Conservá las columnas de datos originales. Guardá el archivo como .xlsx y subilo acá. Podés usar Excel, LibreOffice o Google Sheets.</p><a className={styles.download} href={`/api/prueba/${token}/planilla`} download>Descargar planilla de práctica</a><label className={styles.upload}>Subir planilla resuelta<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => void subirPlanilla(e.target.files?.[0])} /></label>{estado.planilla && <p>Archivo recibido: <strong>{estado.planilla.nombreArchivo}</strong>{estado.planilla.origenIntacto === false && <>. Se modificaron datos originales: revisá las columnas A:D y volvé a subirlo.</>}</p>}</section>
                <section className={styles.card}><span className={styles.step}>04 · ATENCIÓN</span><h2>Respondé a clientes</h2><p>Imaginá que trabajás en una empresa ficticia. Usá sólo estas reglas para responder; escribí un mensaje claro y amable para cada consulta.</p><ul>{REGLAS_CLIENTES.map(regla => <li key={regla}>{regla}</li>)}</ul>{CONSULTAS_CLIENTES.map((consulta, i) => <div className={styles.case} key={consulta}><h3>Consulta {i + 1}</h3><blockquote>{consulta}</blockquote><textarea aria-label={`Respuesta a consulta ${i + 1}`} rows={4} value={clientes[i]} onChange={e => setClientes(prev => prev.map((v, n) => n === i ? e.target.value : v))} /></div>)}</section>
                <button className={styles.primary} disabled={!activa || ocupado || !estado.planilla || clientes.some(v => !v.trim()) || Object.values(errores).some(v => !v.trim())} onClick={entregar}>{ocupado ? 'Guardando…' : 'Entregar prueba'}</button>
            </fieldset>
        </>}
    </main>
}
