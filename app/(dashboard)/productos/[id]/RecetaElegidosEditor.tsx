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
const avisarCambioReceta = () => { try { window.localStorage.setItem('recetas-elegidos-actualizadas', `${Date.now()}:${Math.random()}`) } catch { /* almacenamiento deshabilitado */ } }

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
    const [masivo, setMasivo] = useState({ insumoId: '', cantidad: '', merma: '0', codigosSabor: [] as string[] })
    const [guardandoMasivo, setGuardandoMasivo] = useState(false)

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
    const yaTieneInsumo = (codigo: string) => datos?.recetasElegidos.some(linea =>
        linea.alcance === 'sabor' && linea.variante?.codigo === codigo && linea.insumo.id === masivo.insumoId) ?? false
    const nuevosMasivo = masivo.codigosSabor.filter(codigo => !yaTieneInsumo(codigo)).length

    function alternarSabor(codigo: string) {
        setMasivo(actual => ({ ...actual, codigosSabor: actual.codigosSabor.includes(codigo)
            ? actual.codigosSabor.filter(item => item !== codigo) : [...actual.codigosSabor, codigo] }))
    }

    async function guardarMasivo(event: React.FormEvent) {
        event.preventDefault()
        if (guardandoMasivo) return
        setGuardandoMasivo(true); setError(''); setMensaje('')
        try {
            const res = await fetch(`/api/productos/${productoId}/recetas-elegidos`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...masivo, cantidad: Number(masivo.cantidad), merma: Number(masivo.merma) }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'No se pudo aplicar el insumo a los sabores.')
            await cargar()
            avisarCambioReceta()
            setMasivo(actual => ({ ...actual, insumoId: '', cantidad: '' }))
            setMensaje(`Insumo agregado a ${json.creados} sabores. ${json.omitidos} ya lo tenían y quedaron sin cambios.`)
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') }
        finally { setGuardandoMasivo(false) }
    }

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
            avisarCambioReceta()
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
            avisarCambioReceta()
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
            {alcance === 'sabor' && <details style={{ margin: '14px 0', padding: 14, border: '1px solid var(--color-gray-200)', borderRadius: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Agregar un insumo a varios sabores</summary>
                <p>Se usa la misma cantidad neta y merma por plancha de 8 en los sabores marcados. Si el insumo ya está en una ficha, esa línea no se modifica.</p>
                <form onSubmit={guardarMasivo}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                        <label>Insumo<select className="form-select" value={masivo.insumoId} onChange={e => setMasivo({ ...masivo, insumoId: e.target.value })} required>
                            <option value="">Seleccionar...</option>{datos.insumos.map(x => <option key={x.id} value={x.id}>{x.nombre} · {x.unidadMedida}</option>)}
                        </select></label>
                        <label>Cantidad neta por plancha<input className="form-input" type="number" min="0.000001" step="any" value={masivo.cantidad}
                            onChange={e => setMasivo({ ...masivo, cantidad: e.target.value })} required /></label>
                        <label>Merma %<input className="form-input" type="number" min="0" max="99.99" step="0.01" value={masivo.merma}
                            onChange={e => setMasivo({ ...masivo, merma: e.target.value })} required /></label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMasivo(actual => ({ ...actual,
                            codigosSabor: datos.sabores.map(sabor => sabor.codigo) }))}>Marcar todos</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMasivo(actual => ({ ...actual, codigosSabor: [] }))}>Limpiar</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 14 }}>
                        {datos.sabores.map(sabor => <label key={sabor.codigo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={masivo.codigosSabor.includes(sabor.codigo)} onChange={() => alternarSabor(sabor.codigo)} />
                            {sabor.nombre}{masivo.insumoId && yaTieneInsumo(sabor.codigo) && <small>· ya cargado</small>}
                        </label>)}
                    </div>
                    <p>{masivo.codigosSabor.length} sabores seleccionados: {nuevosMasivo} nuevos y {masivo.codigosSabor.length - nuevosMasivo} sin cambios.</p>
                    <button className="btn btn-primary btn-sm" disabled={guardandoMasivo || !masivo.codigosSabor.length || !nuevosMasivo}>
                        {guardandoMasivo ? 'Guardando...' : 'Agregar a los sabores seleccionados'}
                    </button>
                </form>
            </details>}
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
