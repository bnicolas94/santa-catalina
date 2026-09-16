'use client'

import { useEffect, useState } from 'react'
import { fechaClaveRRHH, sumarDiasRRHH } from '@/lib/rrhh/fechas'
import { resolverHorarioPlanificado, validarHorarioEsperado, type HorarioEsperado, type PlanificacionHorario } from '@/lib/rrhh/horarios'

type Empleado = { id: string; nombre: string; apellido: string | null; activo?: boolean }
type Marca = { empleadoId: string; fechaHora: string; tipo: string }
const vacio: PlanificacionHorario = { plantillas: [], excepciones: [] }
function lunes(fecha: string) { const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay(); return sumarDiasRRHH(fecha, -(dia === 0 ? 6 : dia - 1)) }
function claveHorario(h: HorarioEsperado | null) { return h ? h.esFranco ? 'franco' : `${h.horaInicio}-${h.horaFin}-${h.horasEsperadas}-${h.toleranciaMinutos}` : 'habitual' }
const franco: HorarioEsperado = { esFranco: true, horaInicio: '00:00', horaFin: '00:00', horasEsperadas: 0, toleranciaMinutos: 0 }

export default function PlanificadorSemanal({ empleados }: { empleados: Empleado[] }) {
    const [desde, setDesde] = useState(lunes(fechaClaveRRHH(new Date())))
    const [busqueda, setBusqueda] = useState('')
    const [plan, setPlan] = useState(vacio)
    const [marcas, setMarcas] = useState<Marca[]>([])
    const [cambios, setCambios] = useState<Record<string, HorarioEsperado | null>>({})
    const [turnos, setTurnos] = useState<HorarioEsperado[]>([])
    const [ocupado, setOcupado] = useState(false)
    const [cargado, setCargado] = useState(false)
    const [progreso, setProgreso] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [nuevo, setNuevo] = useState<HorarioEsperado>({ horaInicio: '09:00', horaFin: '17:00', horasEsperadas: 8, toleranciaMinutos: 10 })
    const activos = empleados.filter(e => e.activo !== false)
    const ids = activos.map(e => e.id).join(',')
    const fechas = Array.from({ length: 7 }, (_, i) => sumarDiasRRHH(desde, i))
    const visibles = activos.filter(e => `${e.nombre} ${e.apellido || ''}`.toLowerCase().includes(busqueda.toLowerCase()))
    async function consultar(inicio: string, signal?: AbortSignal) {
        const res = await fetch(`/api/empleados/horarios?empleadoIds=${encodeURIComponent(ids)}&desde=${inicio}&hasta=${sumarDiasRRHH(inicio, 6)}`, { signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        return { plan: { plantillas: data.plantillas.map((p: PlanificacionHorario['plantillas'][number]) => ({ ...p, vigenciaDesde: new Date(p.vigenciaDesde) })), excepciones: data.excepciones.map((e: PlanificacionHorario['excepciones'][number]) => ({ ...e, fecha: new Date(e.fecha) })) } as PlanificacionHorario, marcas: data.fichadas as Marca[] }
    }
    useEffect(() => {
        if (!ids) return
        const controller = new AbortController()
        setOcupado(true); setCargado(false); setMensaje('')
        consultar(desde, controller.signal).then(data => { setPlan(data.plan); setMarcas(data.marcas); setCambios({}); setCargado(true) })
            .catch(error => { if (!controller.signal.aborted) setMensaje(error.message) })
            .finally(() => { if (!controller.signal.aborted) setOcupado(false) })
        fetch('/api/turnos', { signal: controller.signal }).then(res => res.json()).then(data => { if (Array.isArray(data)) setTurnos(data.filter(t => t.activo).map(t => ({ horaInicio: t.horaInicio, horaFin: t.horaFin, horasEsperadas: (Number(t.horaFin.slice(0, 2)) * 60 + Number(t.horaFin.slice(3)) - Number(t.horaInicio.slice(0, 2)) * 60 - Number(t.horaInicio.slice(3))) / 60, toleranciaMinutos: t.toleranciaMinutos }))) }).catch(() => {})
        return () => controller.abort()
        // La nómina se identifica por sus IDs, sin recargar ante renders del padre.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [desde, ids])
    const opciones = new Map<string, HorarioEsperado>()
    for (const h of turnos) opciones.set(claveHorario(h), h)
    for (const e of activos) for (const fecha of fechas) { const h = resolverHorarioPlanificado(plan, e.id, fecha); if (h && !h.esFranco) opciones.set(claveHorario(h), h) }
    for (const h of Object.values(cambios)) if (h && !h.esFranco) opciones.set(claveHorario(h), h)
    function navegar(fecha: string) { if (Object.keys(cambios).length && !confirm('Hay cambios sin guardar. ¿Querés descartarlos y cambiar de semana?')) return; setDesde(lunes(fecha)) }
    async function copiar() {
        if (Object.keys(cambios).length && !confirm('La copia reemplazará los cambios pendientes de los empleados visibles. ¿Continuar?')) return
        setOcupado(true)
        try {
            const anterior = await consultar(sumarDiasRRHH(desde, -7))
            const copia: Record<string, HorarioEsperado | null> = {}
            for (const e of visibles) for (const fecha of fechas) {
                const h = resolverHorarioPlanificado(anterior.plan, e.id, sumarDiasRRHH(fecha, -7))
                if (claveHorario(h) !== claveHorario(resolverHorarioPlanificado(plan, e.id, fecha)) || Object.hasOwn(cambios, `${e.id}|${fecha}`)) copia[`${e.id}|${fecha}`] = h
            }
            setCambios(actual => ({ ...actual, ...copia })); setMensaje('Semana copiada en vista previa. Revisá y guardá para aplicarla. Los días habituales siguen usando el horario habitual.')
        } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo copiar.') }
        finally { setOcupado(false) }
    }
    async function guardar() {
        setOcupado(true); setMensaje('')
        let guardados = 0
        const errores: string[] = []
        const pendientes = { ...cambios }
        let procesados = 0
        for (const [clave, horario] of Object.entries(cambios)) {
            setProgreso(`Guardando día ${++procesados} de ${Object.keys(cambios).length}…`)
            const [empleadoId, fecha] = clave.split('|')
            try {
                const res = await fetch('/api/empleados/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modo: 'fecha', empleadoId, fecha, horario }) })
                const data = await res.json(); if (!res.ok) throw new Error(data.error)
                delete pendientes[clave]; guardados++
                setPlan(actual => ({ ...actual, excepciones: [...actual.excepciones.filter(e => !(e.empleadoId === empleadoId && fechaClaveRRHH(e.fecha) === fecha)), { empleadoId, fecha: new Date(`${fecha}T00:00:00-03:00`), detalle: horario || {} }] }))
            } catch (error) { errores.push(`${empleados.find(e => e.id === empleadoId)?.nombre} (${fecha}): ${error instanceof Error ? error.message : 'Error'}`) }
        }
        setCambios(pendientes); setOcupado(false); setProgreso('')
        setMensaje(`${guardados} días guardados.${errores.length ? ` Quedaron ${errores.length} sin guardar: ${errores.join(' · ')}` : ' Volvé a abrir la liquidación para actualizarla.'}`)
    }
    return <section className="planner">
        <div className="toolbar"><div><h3>Planificación semanal</h3><p>Asigná horarios previstos sin modificar las fichadas reales.</p></div><button className="btn btn-primary" disabled={ocupado || !cargado || !Object.keys(cambios).length} onClick={guardar}>Guardar cambios ({Object.keys(cambios).length})</button></div>
        <div className="toolbar"><button className="btn btn-outline" disabled={ocupado} onClick={() => navegar(sumarDiasRRHH(desde, -7))}>← Anterior</button><input aria-label="Semana" type="date" value={desde} disabled={ocupado} onChange={e => e.target.value && navegar(e.target.value)} /><strong>{desde} al {fechas[6]}</strong><button className="btn btn-outline" disabled={ocupado} onClick={() => navegar(sumarDiasRRHH(desde, 7))}>Siguiente →</button><button className="btn btn-outline" disabled={ocupado} onClick={copiar}>Copiar semana anterior (visibles)</button><input placeholder="Buscar empleado…" aria-label="Buscar empleado" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
        <details><summary>Agregar una franja reutilizable para esta planificación</summary><div className="toolbar">Entrada<input type="time" value={nuevo.horaInicio} onChange={e => setNuevo({ ...nuevo, horaInicio: e.target.value })} />Salida<input type="time" value={nuevo.horaFin} onChange={e => setNuevo({ ...nuevo, horaFin: e.target.value })} />Horas normales<input aria-label="Horas normales" type="number" min="0.25" step="0.25" value={nuevo.horasEsperadas} onChange={e => setNuevo({ ...nuevo, horasEsperadas: Number(e.target.value) })} />Tolerancia<input aria-label="Tolerancia" type="number" min="0" max="60" value={nuevo.toleranciaMinutos} onChange={e => setNuevo({ ...nuevo, toleranciaMinutos: Number(e.target.value) })} /><button className="btn btn-outline" onClick={() => { try { const h = validarHorarioEsperado(nuevo); setTurnos(actual => [...actual, h]); setMensaje('Franja agregada al selector. Se conservará al guardar días que la utilicen.') } catch (error) { setMensaje(error instanceof Error ? error.message : 'Franja inválida.') } }}>Agregar al selector</button></div></details>
        <p role="status">{ocupado ? progreso || 'Procesando planificación…' : mensaje}</p>
        <div className="grid"><table><thead><tr><th>Empleado</th>{fechas.map((f, i) => <th key={f}>{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i]}<small>{f.slice(8)}/{f.slice(5, 7)}</small></th>)}</tr></thead><tbody>{visibles.map(e => <tr key={e.id}><th>{e.nombre} {e.apellido}</th>{fechas.map(fecha => {
            const key = `${e.id}|${fecha}`
            const pendiente = Object.hasOwn(cambios, key)
            const h = pendiente ? cambios[key] : resolverHorarioPlanificado(plan, e.id, fecha)
            const reales = marcas.filter(m => m.empleadoId === e.id && fechaClaveRRHH(m.fechaHora) === fecha)
            return <td key={fecha} className={pendiente ? 'pending' : h?.esFranco ? 'rest' : ''}><select aria-label={`${e.nombre} ${fecha}`} disabled={ocupado || !cargado} value={claveHorario(h)} onChange={event => setCambios(actual => ({ ...actual, [key]: event.target.value === 'habitual' ? null : event.target.value === 'franco' ? franco : opciones.get(event.target.value)! }))}><option value="habitual">Horario habitual</option><option value="franco">Franco</option>{[...opciones].map(([k, turno]) => <option key={k} value={k}>{turno.horaInicio}–{turno.horaFin} · {turno.horasEsperadas} h</option>)}</select><small>{pendiente ? 'Sin guardar' : h ? 'Planificado' : 'Heredado'}</small><div className="actual">{reales.length ? `Real: ${reales.map(m => `${m.tipo === 'entrada' ? '↓' : '↑'} ${new Date(m.fechaHora).toLocaleTimeString('es-AR', { timeZone: 'America/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false })}`).join(' · ')}` : 'Sin fichadas'}</div>{h?.esFranco && reales.length > 0 && <small>Revisar: trabajó en franco</small>}</td>
        })}</tr>)}</tbody></table></div>
        <p className="note">Los cambios se guardan por día. Períodos pagados o cerrados se rechazan y quedan pendientes para revisión. Un franco sin fichadas no se considera ausencia; si hay fichadas, se conserva el cálculo de lo trabajado.</p>
        <style jsx>{`.planner{padding:24px;max-height:70vh;overflow:auto;background:#f8fafc}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px}h3,p{margin:0 0 8px}.toolbar input{padding:9px;border:1px solid #cbd5e1;border-radius:8px;max-width:180px}.grid{overflow:auto;border:1px solid #e2e8f0;border-radius:12px;background:white}table{border-collapse:collapse;width:100%;min-width:1250px}th,td{padding:12px;border-bottom:1px solid #e2e8f0;border-right:1px solid #eef2f6;text-align:left;min-width:145px}thead th{background:#eef2f6;position:sticky;top:0;z-index:2}th:first-child{position:sticky;left:0;background:#fff;min-width:180px;z-index:1}thead th:first-child{z-index:3;background:#eef2f6}select{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:7px;background:white;font-size:12px}small{display:block;color:#64748b;font-size:11px;margin-top:5px}.pending{background:#fff7ed}.rest{background:#ecfdf5}.actual{font-size:11px;color:#475569;margin-top:10px}.note{font-size:12px;color:#64748b;margin-top:16px}details{padding:12px;background:white;border-radius:8px}summary{cursor:pointer}`}</style>
    </section>
}
