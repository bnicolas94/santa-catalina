'use client'

import { useState } from 'react'
import useSWR from 'swr'

type Filtros = { desde: string; hasta: string; chofer: string; turno: string; pago: string; origen: string; buscar: string }
type Registro = { origen: string; id: string; fecha: string; turno: string; chofer: string; nombre: string; direccion: string; ubicacion: string; pago: string; importe: number }
type Grupo = { fecha: string; turno: string; chofer: string; pedidos: number; ingresoEsperado: number; efectivo: number; transferencia: number }
type TotalChofer = Omit<Grupo, 'fecha' | 'turno'>
type Reporte = { actualizado: string; tieneColumnaChofer: boolean; calidad: { sinChofer: number; sinTurno: number; sinFechaEntrega: number; sinPrecio: number; duplicados: number; conflictos: number; noEntregados: number }; totalPedidos: number;
    ingresoAsignado: number; ingresoSinChofer: number; opciones: { choferes: string[]; turnos: string[]; pagos: string[]; origenes: string[] }; porChofer: TotalChofer[]; porChoferDiaTurno: Grupo[]; registros: Registro[] }

const moneda = (valor: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor)
function hoyArgentina() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
function inicioMes(fecha: string) { return `${fecha.slice(0, 7)}-01` }
const fetcher = async (url: string): Promise<Reporte> => {
    const res = await fetch(url)
    const datos = await res.json()
    if (!res.ok) throw new Error(datos.error || 'No se pudo cargar el reporte.')
    return datos
}

export default function RepartosPage() {
    const [filtros, setFiltros] = useState<Filtros>(() => { const hoy = hoyArgentina(); return { desde: inicioMes(hoy), hasta: hoy, chofer: '', turno: '', pago: '', origen: '', buscar: '' } })
    const [aplicados, setAplicados] = useState<Filtros>(filtros)
    const parametros = new URLSearchParams(aplicados).toString()
    const { data: reporte, error, isLoading: cargando } = useSWR<Reporte>(`/api/logistica/repartos?${parametros}`, fetcher)

    const cambiar = (campo: keyof Filtros, valor: string) => setFiltros(actual => ({ ...actual, [campo]: valor }))
    const selector = (campo: 'chofer' | 'turno' | 'pago' | 'origen', titulo: string, opciones: string[]) => (
        <label className="form-group">{titulo}<select className="form-select" value={filtros[campo]} onChange={e => cambiar(campo, e.target.value)}>
            <option value="">Todos</option>{opciones.map(x => <option key={x} value={x}>{x}</option>)}
        </select></label>
    )

    return <div>
        <div className="page-header"><div><h1>Repartos del Google Sheet</h1><p>Pedidos Delivery por fecha de entrega. Los importes son ingresos esperados, no rendiciones confirmadas.</p></div></div>
        <form className="card" onSubmit={e => { e.preventDefault(); setAplicados({ ...filtros }) }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
                <label className="form-group">Desde<input className="form-input" type="date" value={filtros.desde} onChange={e => cambiar('desde', e.target.value)} required /></label>
                <label className="form-group">Hasta<input className="form-input" type="date" value={filtros.hasta} onChange={e => cambiar('hasta', e.target.value)} required /></label>
                {selector('chofer', 'Chofer', reporte?.opciones.choferes ?? [])}
                {selector('turno', 'Turno', reporte?.opciones.turnos ?? [])}
                {selector('pago', 'Pago', reporte?.opciones.pagos ?? [])}
                {selector('origen', 'Hoja', reporte?.opciones.origenes ?? [])}
                <label className="form-group">Buscar ID, cliente o dirección<input className="form-input" value={filtros.buscar} onChange={e => cambiar('buscar', e.target.value)} maxLength={100} /></label>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}><button type="submit" className="btn btn-primary">Aplicar filtros</button>
                <a className="btn btn-outline" href={`/api/logistica/repartos?${parametros}&formato=csv`}>Exportar CSV</a></div>
        </form>
        {error && <div className="toast toast-error">{error.message}</div>}
        {cargando && <p>Cargando repartos…</p>}
        {reporte && <>
            {!reporte.tieneColumnaChofer && <div className="card" style={{ marginTop: 'var(--space-4)', borderColor: 'var(--color-warning)' }}>
                El Sheet todavía no tiene una columna <strong>Chofer</strong>. Los importes figuran sin asignar; al agregarla y completar los pedidos, aparecerá el desglose por persona.
            </div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <div className="card"><strong>Pedidos entregados</strong><div style={{ fontSize: '1.5rem' }}>{reporte.totalPedidos}</div></div>
                <div className="card"><strong>Ingreso esperado asignado</strong><div style={{ fontSize: '1.5rem' }}>{moneda(reporte.ingresoAsignado)}</div></div>
                <div className="card"><strong>Ingreso sin chofer</strong><div style={{ fontSize: '1.5rem' }}>{moneda(reporte.ingresoSinChofer)}</div></div>
            </div>
            <p style={{ marginTop: 'var(--space-3)' }}>Cobertura: {reporte.calidad.sinChofer} sin chofer, {reporte.calidad.sinTurno} sin turno, {reporte.calidad.sinFechaEntrega} sin fecha de entrega, {reporte.calidad.sinPrecio} sin precio, {reporte.calidad.conflictos} IDs en conflicto. Actualizado: {new Date(reporte.actualizado).toLocaleString('es-AR')}.</p>
            <section className="card" style={{ marginTop: 'var(--space-4)', overflowX: 'auto' }}><h2>Total por chofer</h2>
                <table className="table"><thead><tr><th>Chofer</th><th>Pedidos</th><th>Ingreso esperado</th><th>Efectivo</th><th>Transferencia</th></tr></thead><tbody>
                    {reporte.porChofer.map(g => <tr key={g.chofer}><td>{g.chofer}</td><td>{g.pedidos}</td><td>{moneda(g.ingresoEsperado)}</td><td>{moneda(g.efectivo)}</td><td>{moneda(g.transferencia)}</td></tr>)}
                    {!reporte.porChofer.length && <tr><td colSpan={5}>No hay repartos para estos filtros.</td></tr>}
                </tbody></table>
            </section>
            <section className="card" style={{ marginTop: 'var(--space-4)', overflowX: 'auto' }}><h2>Por chofer, día y turno</h2>
                <table className="table"><thead><tr><th>Fecha</th><th>Turno</th><th>Chofer</th><th>Pedidos</th><th>Ingreso esperado</th><th>Efectivo</th><th>Transferencia</th></tr></thead><tbody>
                    {reporte.porChoferDiaTurno.map(g => <tr key={`${g.fecha}:${g.turno}:${g.chofer}`}><td>{g.fecha}</td><td>{g.turno}</td><td>{g.chofer}</td><td>{g.pedidos}</td><td>{moneda(g.ingresoEsperado)}</td><td>{moneda(g.efectivo)}</td><td>{moneda(g.transferencia)}</td></tr>)}
                    {!reporte.porChoferDiaTurno.length && <tr><td colSpan={7}>No hay repartos para estos filtros.</td></tr>}
                </tbody></table>
            </section>
            <section className="card" style={{ marginTop: 'var(--space-4)', overflowX: 'auto' }}><h2>Detalle de pedidos</h2>
                <table className="table"><thead><tr><th>Fecha</th><th>Turno</th><th>Chofer</th><th>ID</th><th>Cliente</th><th>Dirección</th><th>Ubicación</th><th>Pago</th><th>Importe</th></tr></thead><tbody>
                    {reporte.registros.slice(0, 100).map(r => <tr key={`${r.origen}:${r.id}`}><td>{r.fecha}</td><td>{r.turno}</td><td>{r.chofer}</td><td>{r.id}</td><td>{r.nombre}</td><td>{r.direccion}</td><td>{r.ubicacion}</td><td>{r.pago}</td><td>{moneda(r.importe)}</td></tr>)}
                </tbody></table>
                {reporte.registros.length > 100 && <p>Se muestran 100 de {reporte.registros.length} pedidos. El CSV incluye todos los filtrados.</p>}
            </section>
        </>}
    </div>
}
