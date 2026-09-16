'use client'

import { useEffect, useState } from 'react'
import { fechaClaveRRHH } from '@/lib/rrhh/fechas'
import type { DiaPlantillaHorario, HorarioEsperado } from '@/lib/rrhh/horarios'

const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const inicial: HorarioEsperado = { horaInicio: '09:00', horaFin: '17:00', horasEsperadas: 8, toleranciaMinutos: 10 }

export default function HorariosRotativosPanel({ empleados }: { empleados: Array<{ id: string; nombre: string; apellido: string | null }> }) {
    const [empleadoId, setEmpleadoId] = useState('')
    const [fecha, setFecha] = useState(fechaClaveRRHH(new Date()))
    const [dias, setDias] = useState<DiaPlantillaHorario[]>([])
    const [horario, setHorario] = useState(inicial)
    const [ocupado, setOcupado] = useState(false)
    const [mensaje, setMensaje] = useState('')
    useEffect(() => {
        if (!empleadoId) return
        const controller = new AbortController()
        setOcupado(true)
        setMensaje('')
        fetch(`/api/empleados/horarios?empleadoId=${encodeURIComponent(empleadoId)}&desde=${fecha}&hasta=${fecha}`, { signal: controller.signal })
            .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); return data })
            .then(data => {
                const plantilla = data.plantillas.sort((a: { vigenciaDesde: string }, b: { vigenciaDesde: string }) => b.vigenciaDesde.localeCompare(a.vigenciaDesde))[0]
                setDias(plantilla?.dias || [])
                setHorario(data.excepciones[0]?.detalle?.horaInicio ? data.excepciones[0].detalle : inicial)
            })
            .catch(error => { if (!controller.signal.aborted) setMensaje(error.message) })
            .finally(() => { if (!controller.signal.aborted) setOcupado(false) })
        return () => controller.abort()
    }, [empleadoId, fecha])

    async function guardar(modo: 'plantilla' | 'fecha', restablecer = false) {
        setOcupado(true)
        setMensaje('')
        try {
            const res = await fetch('/api/empleados/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empleadoId, modo, desde: fecha, fecha, dias, horario: restablecer ? null : horario }) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setMensaje('Planificación guardada. Volvé a abrir la liquidación para actualizar su cálculo.')
        } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo guardar.') }
        finally { setOcupado(false) }
    }
    function campos(valor: HorarioEsperado, cambiar: (valor: HorarioEsperado) => void) {
        return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label>Entrada<input className="form-input" type="time" value={valor.horaInicio} onChange={e => cambiar({ ...valor, horaInicio: e.target.value })} /></label>
            <label>Salida<input className="form-input" type="time" value={valor.horaFin} onChange={e => cambiar({ ...valor, horaFin: e.target.value })} /></label>
            <label>Horas normales<input className="form-input" style={{ width: 110 }} type="number" min="0.25" max="24" step="0.25" value={valor.horasEsperadas} onChange={e => cambiar({ ...valor, horasEsperadas: Number(e.target.value) })} /></label>
            <label>Tolerancia (min)<input className="form-input" style={{ width: 110 }} type="number" min="0" max="60" value={valor.toleranciaMinutos} onChange={e => cambiar({ ...valor, toleranciaMinutos: Number(e.target.value) })} /></label>
        </div>
    }
    return <section style={{ padding: 24, maxHeight: '65vh', overflowY: 'auto' }}>
        <p>Configurá horarios repetidos o una franja particular para un día. Los días sin planificación mantienen el horario habitual; no se convierten en francos.</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
            <label>Empleado<select className="form-input" value={empleadoId} onChange={e => setEmpleadoId(e.target.value)}><option value="">Seleccionar…</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}</select></label>
            <label>Fecha / inicio de vigencia<input className="form-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
        </div>
        <fieldset disabled={ocupado || !empleadoId} style={{ border: 0, padding: 0 }}>
            <h3>Plantilla semanal</h3>
            <p>Se aplica desde la fecha elegida, sin cambiar versiones anteriores. Para corregir un día pasado usá la excepción.</p>
            {nombres.map((nombre, diaSemana) => {
                const dia = dias.find(d => d.diaSemana === diaSemana)
                return <div key={nombre} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <label><input type="checkbox" checked={!!dia} onChange={e => setDias(e.target.checked ? [...dias, { diaSemana, ...inicial }] : dias.filter(d => d.diaSemana !== diaSemana))} /> {nombre}</label>
                    {dia && campos(dia, valor => setDias(dias.map(d => d.diaSemana === diaSemana ? { ...valor, diaSemana } : d)))}
                </div>
            })}
            <button className="btn btn-primary" style={{ margin: '16px 0' }} onClick={() => guardar('plantilla')}>Guardar plantilla desde esta fecha</button>
            <h3>Excepción para la fecha elegida</h3>
            {campos(horario, setHorario)}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}><button className="btn btn-primary" onClick={() => guardar('fecha')}>Guardar sólo este día</button><button className="btn btn-outline" onClick={() => guardar('fecha', true)}>Volver a la plantilla</button></div>
        </fieldset>
        <p role="status">{ocupado ? 'Procesando…' : mensaje}</p>
        <small>No se admiten cambios en períodos pagados o cerrados. Por ahora las franjas deben comenzar y terminar en el mismo día.</small>
    </section>
}
