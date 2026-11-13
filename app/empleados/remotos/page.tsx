'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { estadoFichadoRemoto, type EstadoFichadoRemoto } from '@/lib/rrhh/fichado-remoto'
import { resumirJornadaRemota } from '@/lib/rrhh/resumen-jornada-remota'
import styles from './remotos.module.css'

type Marca = { id: string; fechaHora: string; tipo: string; origen: string }
type EmpleadoRemoto = {
    id: string
    nombre: string
    apellido: string | null
    horasEsperadas: number
    horarioPrevisto: { entrada: string | null; salida: string | null } | null
    horarioEntradaComputable: string | null
    marcas: Marca[]
}
type VistaRemotos = { fecha: string; ahoraServidor: string; empleados: EmpleadoRemoto[] }

const estados: Record<EstadoFichadoRemoto, string> = {
    sin_iniciar: 'Sin iniciar',
    trabajando: 'Trabajando',
    descansando: 'En descanso',
    finalizado: 'Finalizó',
}
const etiquetas: Record<string, string> = {
    remoto_entrada: 'Entrada',
    remoto_inicio_descanso: 'Inicio del descanso',
    remoto_fin_descanso: 'Fin del descanso',
    remoto_salida: 'Salida',
}

function tiempo(minutos: number) {
    return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`
}

function horaArgentina(fecha: string) {
    return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(fecha))
}

function fechaArgentina(fecha: string) {
    const [anio, mes, dia] = fecha.split('-')
    return `${dia}/${mes}/${anio}`
}

export default function TrabajadoresRemotosPage() {
    const [vista, setVista] = useState<VistaRemotos | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [filtro, setFiltro] = useState<EstadoFichadoRemoto | 'todos'>('todos')
    const [sincronizadoEn, setSincronizadoEn] = useState(0)
    const [ahoraLocal, setAhoraLocal] = useState(0)
    const ultimaConsulta = useRef(0)

    const actualizar = useCallback(async () => {
        const consulta = ++ultimaConsulta.current
        try {
            const respuesta = await fetch('/api/empleados/remotos', { cache: 'no-store' })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar el fichado remoto.')
            if (consulta !== ultimaConsulta.current) return
            const recibidoEn = performance.now()
            setVista(datos)
            setSincronizadoEn(recibidoEn)
            setAhoraLocal(recibidoEn)
            setError('')
        } catch (causa) {
            if (consulta === ultimaConsulta.current) {
                setError(causa instanceof Error ? causa.message : 'No se pudo actualizar el fichado remoto.')
            }
        } finally {
            if (consulta === ultimaConsulta.current) setCargando(false)
        }
    }, [])

    useEffect(() => { void actualizar() }, [actualizar])
    useEffect(() => {
        const reloj = window.setInterval(() => setAhoraLocal(performance.now()), 1000)
        const refresco = window.setInterval(() => { void actualizar() }, 30_000)
        const alVolver = () => { void actualizar() }
        window.addEventListener('focus', alVolver)
        return () => {
            window.clearInterval(reloj)
            window.clearInterval(refresco)
            window.removeEventListener('focus', alVolver)
        }
    }, [actualizar])

    const ahora = vista && sincronizadoEn
        ? new Date(new Date(vista.ahoraServidor).getTime() + Math.min(60_000, Math.max(0, ahoraLocal - sincronizadoEn)))
        : null
    const filas = vista && ahora ? vista.empleados.map(empleado => ({
        empleado,
        estado: estadoFichadoRemoto(empleado.marcas),
        resumen: resumirJornadaRemota(empleado.marcas, ahora, empleado.horasEsperadas, empleado.horarioEntradaComputable),
    })) : []
    const visibles = filas.filter(({ empleado, estado }) =>
        (filtro === 'todos' || estado === filtro)
        && `${empleado.nombre} ${empleado.apellido || ''}`.toLocaleLowerCase('es-AR').includes(busqueda.trim().toLocaleLowerCase('es-AR')),
    )
    const totales = {
        trabajando: filas.filter(fila => fila.estado === 'trabajando').length,
        descansando: filas.filter(fila => fila.estado === 'descansando').length,
        finalizado: filas.filter(fila => fila.estado === 'finalizado').length,
    }

    return <div className={styles.page}>
        <div className={styles.heading}>
            <div>
                <p className={styles.eyebrow}>Equipo y RR. HH.</p>
                <h1>Fichado remoto</h1>
                <p>Jornada de hoy, {vista ? fechaArgentina(vista.fecha) : 'Argentina'}. Se actualiza cada 30 segundos.</p>
            </div>
            <button type="button" className={styles.refresh} onClick={() => void actualizar()}>Actualizar ahora</button>
        </div>

        {error && <p className={styles.error} role="alert">{error}{vista ? ' Los datos pueden estar desactualizados.' : ''}</p>}
        {cargando && !vista && <p className={styles.empty}>Cargando trabajadores remotos…</p>}
        {vista && <>
            <div className={styles.stats}>
                <div><span>Habilitados</span><strong>{filas.length}</strong></div>
                <div><span>Trabajando</span><strong>{totales.trabajando}</strong></div>
                <div><span>En descanso</span><strong>{totales.descansando}</strong></div>
                <div><span>Finalizaron</span><strong>{totales.finalizado}</strong></div>
            </div>

            <div className={styles.toolbar}>
                <div><h2>Trabajadores</h2><p>{visibles.length} de {filas.length} habilitados</p></div>
                <div className={styles.filters}>
                    <input aria-label="Buscar trabajador" placeholder="Buscar por nombre o apellido" value={busqueda} onChange={evento => setBusqueda(evento.target.value)} />
                    <select aria-label="Filtrar por estado" value={filtro} onChange={evento => setFiltro(evento.target.value as typeof filtro)}>
                        <option value="todos">Todos los estados</option>
                        {Object.entries(estados).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
                    </select>
                </div>
            </div>

            {visibles.length === 0 ? <p className={styles.empty}>{filas.length === 0 ? 'Todavía no hay empleados activos con fichado remoto habilitado.' : 'No hay trabajadores para este filtro.'}</p> :
                <div className={styles.list}>{visibles.map(({ empleado, estado, resumen }) => {
                    const ultima = empleado.marcas.at(-1)
                    const entrada = empleado.marcas.find(marca => marca.tipo === 'entrada')
                    const porcentaje = resumen.minutosMeta > 0 ? Math.min(100, resumen.minutosEfectivosActuales / resumen.minutosMeta * 100) : 0
                    return <article key={empleado.id} className={styles.worker}>
                        <div className={styles.workerTop}>
                            <div><h3>{empleado.apellido ? `${empleado.apellido}, ` : ''}{empleado.nombre}</h3><span className={`${styles.badge} ${styles[estado]}`}>{estados[estado]}</span></div>
                            <Link href={`/empleados/${empleado.id}`}>Ver fichadas →</Link>
                        </div>
                        <div className={styles.metrics}>
                            <div><span>Trabajo efectivo</span><strong>{tiempo(resumen.minutosEfectivosActuales)}</strong></div>
                            <div><span>Descansos</span><strong>{tiempo(resumen.minutosDescanso)}</strong></div>
                            <div><span>Restante</span><strong>{tiempo(resumen.minutosRestantes)}</strong></div>
                        </div>
                        <div className={styles.progress} role="progressbar" aria-label={`Progreso de ${empleado.nombre}`} aria-valuemin={0} aria-valuemax={resumen.minutosMeta} aria-valuenow={Math.min(resumen.minutosMeta, resumen.minutosEfectivosActuales)}><div style={{ width: `${porcentaje}%` }} /></div>
                        <div className={styles.details}>
                            <span>Entrada: {entrada ? horaArgentina(entrada.fechaHora) : '—'}</span>
                            <span>Última marca: {ultima ? `${etiquetas[ultima.origen] || ultima.tipo} · ${horaArgentina(ultima.fechaHora)}` : '—'}</span>
                            <span>Jornada prevista: {tiempo(resumen.minutosMeta)}{empleado.horarioPrevisto?.entrada && empleado.horarioPrevisto.salida ? ` · ${empleado.horarioPrevisto.entrada}–${empleado.horarioPrevisto.salida}` : ''}</span>
                        </div>
                    </article>
                })}</div>}

            <p className={styles.note}>El estado refleja la última fichada, no la conexión a la app. El trabajo y el descanso abiertos son estimaciones en vivo; las horas de trabajo se confirman al registrar la siguiente marca.</p>
        </>}
    </div>
}
