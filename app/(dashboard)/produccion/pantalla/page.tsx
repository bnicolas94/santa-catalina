'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import styles from './pantalla.module.css'

type Turno = 'Mañana' | 'Siesta' | 'Tarde'
type Columna = {
    clave: string
    titulo: string
    subtitulo: string
    stockInicial: number
    produccion: number
    recibido: number
    enviado: number
    agendado: number
    pedidosCubiertos: number
    libre: number
}
type DiaPantalla = {
    fecha: string
    columnas: Columna[]
    demanda: Record<Turno, Record<string, number>>
    turnosVisibles: Turno[]
}
type Pantalla = {
    estado: 'listo'
    fecha: string
    actualizadoExcel: string
    stockTomadoAt: string
    stockAjustadoAt: string | null
    dias: DiaPantalla[]
} | { estado: 'esperando_inicio'; fecha: string }

const hora = (valor: string) => new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(valor))
const fechaLocal = (fecha: string, opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-AR', { ...opciones, timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
const ERROR_ACTUALIZACION = 'No se pudo actualizar la pantalla. Se volverá a intentar automáticamente.'

export default function PantallaStockProduccion() {
    const { data: session } = useSession()
    const [datos, setDatos] = useState<Pantalla | null>(null)
    const [error, setError] = useState('')
    const [reloj, setReloj] = useState(new Date())
    const [fechaSeleccionada, setFechaSeleccionada] = useState('')

    const actualizar = useCallback(async () => {
        try {
            const respuesta = await fetch('/api/produccion/pantalla-stock', { cache: 'no-store' })
            const cuerpo = await respuesta.json().catch(() => null) as (Pantalla & { error?: string }) | null
            if (!respuesta.ok) {
                setError(cuerpo?.error || ERROR_ACTUALIZACION)
                return
            }
            if (!cuerpo || !['listo', 'esperando_inicio'].includes(cuerpo.estado)) {
                setError(ERROR_ACTUALIZACION)
                return
            }
            setDatos(cuerpo)
            setError('')
        } catch {
            setError(ERROR_ACTUALIZACION)
        }
    }, [])

    useEffect(() => {
        const primeraConsulta = window.setTimeout(() => void actualizar(), 0)
        const consulta = window.setInterval(() => void actualizar(), 30_000)
        const relojId = window.setInterval(() => setReloj(new Date()), 1_000)
        const alVolver = () => { if (!document.hidden) void actualizar() }
        document.addEventListener('visibilitychange', alVolver)
        return () => {
            window.clearTimeout(primeraConsulta)
            window.clearInterval(consulta)
            window.clearInterval(relojId)
            document.removeEventListener('visibilitychange', alVolver)
        }
    }, [actualizar])

    const dia = datos?.estado === 'listo'
        ? datos.dias.find(item => item.fecha === fechaSeleccionada) ?? datos.dias[0]
        : null
    const hayEntradas = dia?.columnas.some(columna => columna.recibido > 0) ?? false
    const haySalidas = dia?.columnas.some(columna => columna.enviado > 0) ?? false
    const esHoy = datos?.estado === 'listo' && dia?.fecha === datos.fecha
    const fechaVisible = dia
        ? fechaLocal(dia.fecha, { weekday: 'long', day: 'numeric', month: 'long' })
        : new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long',
        }).format(reloj)
    const horaVisible = new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(reloj)
    const rol = (session?.user as { rol?: string } | undefined)?.rol
    const rolVisible = rol === 'ADMIN' ? 'Administrador' : rol === 'ADMIN_OPS' ? 'Administrativo' : rol

    return <main className={styles.pantalla}>
        <header className={styles.encabezado}>
            <div>
                <p className={styles.marca}>SANTA CATALINA · PRODUCCIÓN</p>
                <h1>{esHoy || !dia ? 'Stock y pedidos de hoy' : 'Stock y pedidos proyectados'}</h1>
                <p className={styles.fecha}>{fechaVisible}</p>
            </div>
            <div className={styles.derecha}>
                <strong className={styles.reloj}>{horaVisible}</strong>
                {rolVisible && <span className={styles.sesion}>
                    {session?.user?.name && `${session.user.name} · `}{rolVisible}
                </span>}
                <Link href="/produccion" className={styles.salir}>Salir de la pantalla</Link>
            </div>
        </header>

        {error && <div className={styles.alerta} role="alert">
            {datos ? `La actualización falló: ${error}. Se muestran los últimos datos recibidos.` : error}
        </div>}

        {!datos && !error && <p className={styles.cargando}>Cargando stock y pedidos…</p>}

        {datos?.estado === 'esperando_inicio' && <p className={styles.cargando}>
            El stock inicial se registrará automáticamente a partir de las 9:00.
        </p>}

        {datos?.estado === 'listo' && dia && <>
            <nav className={styles.fechas} aria-label="Elegir fecha de stock y pedidos">
                {datos.dias.map((item, indice) => <button
                    key={item.fecha}
                    type="button"
                    className={`${styles.fechaBoton} ${item.fecha === dia.fecha ? styles.fechaActiva : ''}`}
                    aria-pressed={item.fecha === dia.fecha}
                    onClick={() => setFechaSeleccionada(item.fecha)}
                >{indice === 0 ? 'Hoy' : fechaLocal(item.fecha, { weekday: 'short', day: 'numeric', month: 'short' })}</button>)}
            </nav>
            <div className={styles.estado}>
                <span>{esHoy
                    ? datos.stockAjustadoAt
                        ? `Stock inicial corregido a las ${hora(datos.stockAjustadoAt)}`
                        : `Stock inicial registrado a las ${hora(datos.stockTomadoAt)}`
                    : 'Stock inicial proyectado desde el stock libre del día anterior'}</span>
                <span>Pedidos actualizados a las {hora(datos.actualizadoExcel)}</span>
            </div>
            <div className={styles.tablaScroll}>
                <table className={styles.tabla}>
                    <thead><tr>
                        <th scope="col">Movimiento</th>
                        {dia.columnas.map(columna => <th scope="col" key={columna.clave}>
                            <span>{columna.titulo}</span><small>{columna.subtitulo}</small>
                        </th>)}
                    </tr></thead>
                    <tbody>
                        <tr className={styles.inicial}><th scope="row">Stock inicial</th>
                            {dia.columnas.map(columna => <td key={columna.clave}>{columna.stockInicial}</td>)}
                        </tr>
                        <tr className={styles.produccion}><th scope="row">+ Producido {esHoy ? 'hoy' : 'registrado'}</th>
                            {dia.columnas.map(columna => <td key={columna.clave}>{columna.produccion}</td>)}
                        </tr>
                        {hayEntradas && <tr className={styles.turno}><th scope="row">+ Recibido en fábrica</th>
                            {dia.columnas.map(columna => <td key={columna.clave}>{columna.recibido}</td>)}
                        </tr>}
                        {haySalidas && <tr className={styles.turno}><th scope="row">− Enviado a Local</th>
                            {dia.columnas.map(columna => <td key={columna.clave}>{columna.enviado}</td>)}
                        </tr>}
                        {dia.turnosVisibles.map(turno => <tr key={turno} className={styles.turno}>
                            <th scope="row">− Pedidos {turno.toLowerCase()}</th>
                            {dia.columnas.map(columna => <td key={columna.clave}>
                                {dia.demanda[turno][columna.clave] ?? 0}
                            </td>)}
                        </tr>)}
                        {haySalidas && <tr className={styles.produccion}><th scope="row">+ Pedidos ya enviados</th>
                            {dia.columnas.map(columna => <td key={columna.clave}>{columna.pedidosCubiertos}</td>)}
                        </tr>}
                    </tbody>
                    <tfoot><tr><th scope="row">Stock libre para demanda</th>
                        {dia.columnas.map(columna => <td key={columna.clave} className={columna.libre < 0 ? styles.faltante : ''}>
                            {columna.libre}
                        </td>)}
                    </tr></tfoot>
                </table>
            </div>
            <section className={styles.tarjetas} aria-label="Stock por producto">
                {dia.columnas.map(columna => <article className={styles.tarjeta} key={columna.clave}>
                    <header className={styles.tarjetaTitulo}>
                        <h2>{columna.titulo}</h2>
                        <span>{columna.subtitulo}</span>
                    </header>
                    <dl className={styles.detalle}>
                        <div><dt>Stock inicial</dt><dd>{columna.stockInicial}</dd></div>
                        <div className={styles.detalleProduccion}><dt>+ Producido {esHoy ? 'hoy' : 'registrado'}</dt><dd>{columna.produccion}</dd></div>
                        {hayEntradas && <div><dt>+ Recibido en fábrica</dt><dd>{columna.recibido}</dd></div>}
                        {haySalidas && <div><dt>− Enviado a Local</dt><dd>{columna.enviado}</dd></div>}
                        {dia.turnosVisibles.map(turno => <div key={turno}>
                            <dt>− Pedidos {turno.toLowerCase()}</dt>
                            <dd>{dia.demanda[turno][columna.clave] ?? 0}</dd>
                        </div>)}
                        {haySalidas && <div className={styles.detalleProduccion}>
                            <dt>+ Pedidos ya enviados</dt><dd>{columna.pedidosCubiertos}</dd>
                        </div>}
                    </dl>
                    <div className={`${styles.libre} ${columna.libre < 0 ? styles.libreNegativo : ''}`}>
                        <span>Stock libre para demanda</span>
                        <strong>{columna.libre}</strong>
                    </div>
                </article>)}
            </section>
            <p className={styles.nota}>{esHoy
                ? haySalidas
                    ? 'Los envíos a Local cubren primero los pedidos del Excel de hoy. Sólo el excedente para venta espontánea reduce más el stock libre.'
                    : 'El stock libre descuenta los pedidos de los tres turnos, incluso cuando un turno ya no aparece en la pantalla.'
                : 'Proyección con pedidos agendados. La producción futura se suma cuando se registre en el ERP.'}</p>
        </>}
    </main>
}
