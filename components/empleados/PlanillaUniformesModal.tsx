'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { UniformesTab } from './UniformesTab'
import { ConfiguracionUniformes } from './ConfiguracionUniformes'
import styles from './PlanillaUniformesModal.module.css'
import { nombreEmpleadoApellidoPrimero, ordenarEmpleadosPorApellido } from '@/lib/rrhh/nombres-empleados'

type Empleado = { id: string; nombre: string; apellido: string | null; ubicacionId: string | null }
type Stock = { id: string; prenda: 'REMERA' | 'BUZO'; talle: string; cantidad: number }
type Movimiento = {
    id: string; tipo: string; delta: number; saldoPosterior: number; motivo: string | null; createdAt: string
    stock: { prenda: 'REMERA' | 'BUZO'; talle: string }
    registradoPor: { nombre: string; apellido: string | null }
    entrega: { id: string; empleado: { nombre: string; apellido: string | null } } | null
}

export function PlanillaUniformesModal({ onClose }: { onClose: () => void }) {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [stock, setStock] = useState<Stock[]>([])
    const [movimientos, setMovimientos] = useState<Movimiento[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [empleadoId, setEmpleadoId] = useState('')
    const [pestana, setPestana] = useState<'entregas' | 'stock' | 'configuracion'>('entregas')
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')
    const [prenda, setPrenda] = useState<'REMERA' | 'BUZO'>('REMERA')
    const [talle, setTalle] = useState('')
    const [delta, setDelta] = useState(1)
    const [motivo, setMotivo] = useState('')

    const cargar = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const respuestas = await Promise.all([
                fetch('/api/uniformes'), fetch('/api/uniformes/stock'), fetch('/api/uniformes/movimientos'),
            ])
            if (respuestas.some(respuesta => !respuesta.ok)) throw new Error('No se pudo cargar la ropa de trabajo.')
            const [datosEmpleados, datosStock, datosMovimientos] = await Promise.all(respuestas.map(respuesta => respuesta.json()))
            setEmpleados(datosEmpleados)
            setStock(datosStock)
            setMovimientos(datosMovimientos)
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la ropa de trabajo.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void cargar() }, [cargar])

    const empleadosFiltrados = useMemo(() => ordenarEmpleadosPorApellido(empleados).filter(empleado => {
        const consulta = busqueda.toLocaleLowerCase('es-AR')
        return nombreEmpleadoApellidoPrimero(empleado).toLocaleLowerCase('es-AR').includes(consulta)
            || `${empleado.nombre} ${empleado.apellido || ''}`.toLocaleLowerCase('es-AR').includes(consulta)
    }), [empleados, busqueda])
    const empleadoSeleccionado = empleados.find(empleado => empleado.id === empleadoId)
    const totalPrendas = stock.reduce((total, item) => total + item.cantidad, 0)

    const iniciales = (empleado: Empleado) => `${empleado.nombre[0] || ''}${empleado.apellido?.[0] || ''}`.toUpperCase()

    async function registrarMovimiento(evento: React.FormEvent) {
        evento.preventDefault()
        setGuardando(true)
        setError('')
        try {
            const respuesta = await fetch('/api/uniformes/stock', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prenda, talle, delta, motivo }),
            })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo actualizar el stock.')
            setTalle('')
            setDelta(1)
            setMotivo('')
            await cargar()
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo actualizar el stock.')
        } finally {
            setGuardando(false)
        }
    }

    return <div className={styles.overlay} role="presentation" onMouseDown={onClose}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="uniformes-title" onMouseDown={evento => evento.stopPropagation()}>
        <header className={styles.header}>
            <div><span className={styles.eyebrow}>Gestión de personal</span><h2 id="uniformes-title">Ropa de trabajo</h2><p>Controlá existencias, registrá entregas y emití la constancia reglamentaria desde un único lugar.</p></div>
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className={styles.summary}>
            <div><strong>{empleados.length}</strong><span>Empleados activos</span></div>
            <div><strong>{totalPrendas}</strong><span>Prendas disponibles</span></div>
            <div><strong>{stock.length}</strong><span>Combinaciones de talle</span></div>
        </div>
        <nav className={styles.tabs} aria-label="Secciones de ropa de trabajo">
            <button type="button" className={`${styles.tab} ${pestana === 'entregas' ? styles.tabActive : ''}`} onClick={() => setPestana('entregas')}><span className={styles.tabIcon}>✓</span><span><strong>Entregas</strong><small>Por empleado</small></span></button>
            <button type="button" className={`${styles.tab} ${pestana === 'stock' ? styles.tabActive : ''}`} onClick={() => { setPestana('stock'); void cargar() }}><span className={styles.tabIcon}>□</span><span><strong>Stock y movimientos</strong><small>Existencias y auditoría</small></span></button>
            <button type="button" className={`${styles.tab} ${pestana === 'configuracion' ? styles.tabActive : ''}`} onClick={() => setPestana('configuracion')}><span className={styles.tabIcon}>⚙</span><span><strong>Configuración 299/11</strong><small>Datos reglamentarios</small></span></button>
        </nav>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        <main className={styles.content}>
            {loading ? <div className={styles.loading}><span className={styles.spinner} /><span>Cargando ropa de trabajo…</span></div> : pestana === 'configuracion' ? <div className={styles.configContent}><ConfiguracionUniformes /></div> : pestana === 'entregas' ? <div className={styles.employeeWorkspace}>
                <aside className={styles.employeeSidebar}>
                    <div className={styles.employeeSearch}><label className={styles.searchBox}><span>⌕</span><input value={busqueda} onChange={evento => setBusqueda(evento.target.value)} placeholder="Buscar empleado…" aria-label="Buscar empleado" /></label><small>{empleadosFiltrados.length} resultado{empleadosFiltrados.length === 1 ? '' : 's'}</small></div>
                    <div className={styles.employeeList}>{empleadosFiltrados.length ? empleadosFiltrados.map(empleado => <button type="button" key={empleado.id} className={`${styles.employeeCard} ${empleadoId === empleado.id ? styles.employeeCardActive : ''}`} onClick={() => setEmpleadoId(empleado.id)}><span className={styles.avatar}>{iniciales(empleado)}</span><span><strong>{nombreEmpleadoApellidoPrimero(empleado)}</strong><span>{empleadoId === empleado.id ? 'Ficha seleccionada' : 'Ver entregas y talles'}</span></span></button>) : <div className={styles.empty}>No encontramos empleados con ese nombre.</div>}</div>
                </aside>
                <section className={styles.employeePanel}>{empleadoSeleccionado ? <UniformesTab key={empleadoSeleccionado.id} empleadoId={empleadoSeleccionado.id} /> : <div className={styles.empty}><span className={styles.emptyIcon}>⌕</span><h3>Seleccioná un empleado</h3><p>Vas a poder consultar sus talles, registrar entregas, anular movimientos e imprimir la constancia correspondiente.</p></div>}</section>
            </div> : <div className={styles.stockContent}>
                {esAdmin && <section className={styles.panel}><div className={styles.panelHeader}><div><h3>Registrar movimiento de stock</h3><p>Ingresá una compra o corregí una diferencia de inventario.</p></div></div><form onSubmit={registrarMovimiento} className={styles.panelBody}>
                    <div className={styles.stockForm}>
                        <label className={styles.field}><span>Prenda</span><select className="form-input" value={prenda} onChange={evento => setPrenda(evento.target.value as 'REMERA' | 'BUZO')}><option value="REMERA">Remera</option><option value="BUZO">Buzo</option></select></label>
                        <label className={styles.field}><span>Talle</span><input className="form-input" required maxLength={20} value={talle} onChange={evento => setTalle(evento.target.value)} placeholder="M, L, XL…" /></label>
                        <label className={styles.field}><span>Cambio</span><input className="form-input" type="number" required step={1} value={delta} onChange={evento => setDelta(Number(evento.target.value))} title="Positivo para ingresar, negativo para descontar" /></label>
                        <label className={styles.field}><span>Motivo</span><input className="form-input" required maxLength={500} value={motivo} onChange={evento => setMotivo(evento.target.value)} placeholder="Compra, conteo físico, corrección…" /></label>
                        <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar'}</button>
                    </div><p className={styles.helper}>Los valores positivos ingresan unidades; los negativos corrigen faltantes. Todo movimiento queda auditado.</p>
                </form></section>}
                <section className={styles.panel}><div className={styles.panelHeader}><div><h3>Existencias actuales</h3><p>Disponibilidad total discriminada por prenda y talle.</p></div></div><div className={styles.panelBody}>{stock.length === 0 ? <div className={styles.empty}>Todavía no hay prendas cargadas.</div> : <div className={styles.stockGrid}>{stock.map(item => <article key={item.id} className={styles.stockCard}><div className={styles.stockCardTop}><span className={styles.garment}>{item.prenda === 'REMERA' ? 'T' : '▣'}</span><strong>{item.prenda === 'REMERA' ? 'Remera' : 'Buzo'} · {item.talle}</strong></div><div className={`${styles.stockCount} ${item.cantidad === 0 ? styles.zero : ''}`}>{item.cantidad} <span>unidades</span></div></article>)}</div>}</div></section>
                <section className={styles.panel}><div className={styles.panelHeader}><div><h3>Últimos movimientos</h3><p>Trazabilidad de ingresos, ajustes, entregas y anulaciones.</p></div></div>{movimientos.length === 0 ? <div className={styles.empty}>No hay movimientos registrados.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Fecha</th><th>Prenda</th><th>Movimiento</th><th>Saldo</th><th>Responsable</th><th>Motivo</th></tr></thead><tbody>{movimientos.map(item => <tr key={item.id}>
                    <td>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Buenos_Aires' }).format(new Date(item.createdAt))}</td><td>{item.stock.prenda === 'REMERA' ? 'Remera' : 'Buzo'} · {item.stock.talle}</td><td><span className={item.delta > 0 ? styles.movementPositive : styles.movementNegative}>{item.delta > 0 ? '+' : ''}{item.delta}</span> · {item.tipo}</td><td>{item.saldoPosterior}</td><td>{nombreEmpleadoApellidoPrimero(item.registradoPor)}</td><td>{item.motivo || (item.entrega ? `Entrega a ${nombreEmpleadoApellidoPrimero(item.entrega.empleado)}` : '—')}</td>
                </tr>)}</tbody></table></div>}</section>
            </div>}
        </main>
    </section></div>
}
