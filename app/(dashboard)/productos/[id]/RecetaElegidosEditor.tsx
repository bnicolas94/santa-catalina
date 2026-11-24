'use client'

import { useCallback, useEffect, useState } from 'react'

type Alcance = 'base' | 'sabor' | 'empaque'
type AlcanceEditable = 'sabor' | 'empaque'
type Insumo = { id: string; nombre: string; unidadMedida: string; precioUnitario: number }
type Receta = { id: string; alcance: Alcance; cantidad: number; merma: number; insumo: Insumo;
    variante: { codigo: string } | null; presentacion: { cantidad: number } | null; presentacionId: string | null }
type Datos = { recetasElegidos: Receta[]; sabores: { codigo: string; nombre: string }[];
    insumos: Insumo[]; presentaciones: { id: string; cantidad: number }[] }
type Formulario = { alcance: AlcanceEditable; codigoSabor: string; presentacionId: string; insumoId: string; cantidad: string; merma: string }
const inicial: Formulario = { alcance: 'sabor', codigoSabor: '', presentacionId: '', insumoId: '', cantidad: '', merma: '0' }
const dinero = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export default function RecetaElegidosEditor({ productoId }: { productoId: string }) {
    const [datos, setDatos] = useState<Datos | null>(null)
    const [alcance, setAlcance] = useState<AlcanceEditable>('sabor')
    const [codigoSabor, setCodigoSabor] = useState('')
    const [presentacionId, setPresentacionId] = useState('')
    const [form, setForm] = useState<Formulario>(inicial)
    const [editando, setEditando] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [guardando, setGuardando] = useState(false)

    const cargar = useCallback(async () => {
        const res = await fetch(`/api/productos/${productoId}/recetas-elegidos`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las recetas.')
        setDatos(json)
        setCodigoSabor(actual => actual || json.sabores[0]?.codigo || '')
        setPresentacionId(actual => actual || json.presentaciones[0]?.id || '')
        setForm(actual => ({ ...actual, codigoSabor: actual.codigoSabor || json.sabores[0]?.codigo || '',
            presentacionId: actual.presentacionId || json.presentaciones[0]?.id || '' }))
    }, [productoId])

    useEffect(() => { void cargar().catch(e => setError(e instanceof Error ? e.message : 'Error al cargar recetas.')) }, [cargar])

    const visibles = datos?.recetasElegidos.filter(linea => linea.alcance === alcance &&
        (alcance !== 'sabor' || linea.variante?.codigo === codigoSabor) &&
        (alcance !== 'empaque' || linea.presentacionId === presentacionId)) ?? []
    const titulo = alcance === 'sabor' ? 'Ficha completa por plancha de 8' : 'Empaque por paquete'
    const referencia = alcance === 'sabor' ? '1 plancha de 8 sándwiches'
        : `1 paquete x${datos?.presentaciones.find(p => p.id === presentacionId)?.cantidad ?? '—'}`
    const costo = (linea: Receta) => linea.cantidad / (1 - linea.merma / 100) * linea.insumo.precioUnitario

    function nuevaLinea() {
        setEditando(null)
        setForm({ ...inicial, alcance, codigoSabor, presentacionId })
        setError('')
    }

    function editar(linea: Receta) {
        if (linea.alcance === 'base') return
        setEditando(linea.id)
        setForm({ alcance: linea.alcance, codigoSabor: linea.variante?.codigo ?? '',
            presentacionId: linea.presentacionId ?? '', insumoId: linea.insumo.id,
            cantidad: String(linea.cantidad), merma: String(linea.merma) })
        setError('')
    }

    async function guardar(event: React.FormEvent) {
        event.preventDefault()
        if (guardando) return
        setGuardando(true); setError(''); setMensaje('')
        try {
            const res = await fetch(`/api/productos/${productoId}/recetas-elegidos`, {
                method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, id: editando, cantidad: Number(form.cantidad), merma: Number(form.merma) }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'No se pudo guardar la línea.')
            await cargar()
            setForm({ ...inicial, alcance, codigoSabor, presentacionId })
            setEditando(null)
            setMensaje('Receta guardada.')
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') }
        finally { setGuardando(false) }
    }

    async function quitar(linea: Receta) {
        if (!window.confirm(`¿Quitar ${linea.insumo.nombre} de esta receta?`)) return
        setError(''); setMensaje('')
        try {
            const res = await fetch(`/api/productos/${productoId}/recetas-elegidos?id=${encodeURIComponent(linea.id)}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'No se pudo quitar.')
            await cargar()
            setMensaje('Insumo quitado de la receta.')
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo quitar.') }
    }

    return <div className="card" style={{ marginBottom: 'var(--space-6)' }}><div className="card-body">
        <h2>Fichas por sabor: Elegidos y Premium</h2>
        <p>Cargá en cada sabor todos los insumos necesarios para una plancha completa de 8 sándwiches. El Sheet indica cuántas planchas se pidieron de Tomate, Huevo o un sabor premium; Reportes multiplica la ficha de cada sabor por esas planchas. El empaque se configura por presentación.</p>
        {error && <div className="toast toast-error" style={{ position: 'static', marginBottom: 12 }}>{error}</div>}
        {mensaje && <div className="toast toast-success" style={{ position: 'static', marginBottom: 12 }}>{mensaje}</div>}
        {!datos ? <p>Cargando recetas...</p> : <>
            {datos.recetasElegidos.some(linea => linea.alcance === 'base') && <details style={{ marginBottom: 14 }}>
                <summary>Base común anterior: ya no se suma al costo</summary>
                <p>Estas líneas se conservaron para revisión. Incluí los insumos que correspondan en la ficha completa de cada sabor; después podés quitar las líneas anteriores.</p>
                <ul>{datos.recetasElegidos.filter(linea => linea.alcance === 'base').map(linea => <li key={linea.id}>
                    {linea.insumo.nombre}: {linea.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 6 })} {linea.insumo.unidadMedida} por plancha
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void quitar(linea)}>Quitar</button>
                </li>)}</ul>
            </details>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {([['sabor', 'Ficha por sabor'], ['empaque', 'Empaque']] as const).map(([valor, nombre]) =>
                    <button type="button" key={valor} className={`btn btn-sm ${alcance === valor ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => { setAlcance(valor); setForm({ ...inicial, alcance: valor, codigoSabor, presentacionId }); setEditando(null) }}>{nombre}</button>)}
            </div>
            {alcance === 'sabor' && <label className="form-group"><span className="form-label">Sabor del Sheet</span><select className="form-select" value={codigoSabor} onChange={e => { setCodigoSabor(e.target.value); setForm({ ...inicial, alcance, codigoSabor: e.target.value, presentacionId }); setEditando(null) }}>
                {datos.sabores.map(sabor => <option key={sabor.codigo} value={sabor.codigo}>{sabor.nombre}</option>)}</select></label>}
            {alcance === 'empaque' && <label className="form-group"><span className="form-label">Presentación</span><select className="form-select" value={presentacionId} onChange={e => { setPresentacionId(e.target.value); setForm({ ...inicial, alcance, codigoSabor, presentacionId: e.target.value }); setEditando(null) }}>
                {datos.presentaciones.map(p => <option key={p.id} value={p.id}>Paquete x{p.cantidad}</option>)}</select></label>}
            <h3>{titulo}</h3><p>Las cantidades de esta sección corresponden a {referencia}. La merma se agrega al consumo estimado.</p>
            <div style={{ overflowX: 'auto' }}><table className="table" style={{ width: '100%' }}><thead><tr><th>Insumo</th><th>Cantidad neta</th><th>Merma</th><th>Costo estimado</th><th></th></tr></thead><tbody>
                {visibles.map(linea => <tr key={linea.id}><td>{linea.insumo.nombre}</td><td>{linea.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 6 })} {linea.insumo.unidadMedida}</td><td>{linea.merma}%</td><td>{linea.insumo.precioUnitario > 0 ? dinero(costo(linea)) : 'Falta precio'}</td><td><button type="button" className="btn btn-ghost btn-sm" onClick={() => editar(linea)}>Editar</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => void quitar(linea)}>Quitar</button></td></tr>)}
            </tbody></table>{!visibles.length && <p>Esta receta todavía no tiene insumos cargados.</p>}</div>
            <form onSubmit={guardar} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginTop: 16 }}>
                <label>Insumo<select className="form-select" value={form.insumoId} onChange={e => setForm({ ...form, insumoId: e.target.value })} required><option value="">Seleccionar...</option>{datos.insumos.map(x => <option key={x.id} value={x.id}>{x.nombre} · {x.unidadMedida}</option>)}</select></label>
                <label>Cantidad neta por {referencia}<input className="form-input" type="number" min="0.000001" step="any" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} required /></label>
                <label>Merma %<input className="form-input" type="number" min="0" max="99.99" step="0.01" value={form.merma} onChange={e => setForm({ ...form, merma: e.target.value })} required /></label>
                <button className="btn btn-primary btn-sm" disabled={guardando}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar insumo'}</button>
                {editando && <button type="button" className="btn btn-ghost btn-sm" onClick={nuevaLinea}>Cancelar edición</button>}
            </form>
            <p style={{ marginTop: 14, fontSize: 12 }}>Reportes detecta sabores sin insumos o sin precio, pero no puede saber si omitiste un ingrediente: revisá cada ficha antes de usar el costo. Los cambios de receta y precio recalculan las estimaciones históricas; no descuentan stock ni registran compras.</p>
        </>}
    </div></div>
}
