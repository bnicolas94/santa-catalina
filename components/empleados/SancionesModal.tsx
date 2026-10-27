'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { escaparHtml } from '@/components/analytics/legajo.utils'
import { getPrintLogos } from '@/lib/utils/printLogos'
import { nombreEmpleadoApellidoPrimero } from '@/lib/rrhh/nombres-empleados'

interface SancionesModalProps {
    isOpen: boolean
    onClose: () => void
    empleados: Array<{ id: string; nombre: string; apellido?: string | null }>
}

interface SancionListado {
    id: string
    fecha: string
    tipo: string
    motivo: string
    observaciones?: string | null
    alertaId?: string | null
    empleado: { nombre: string; apellido?: string | null; dni?: string | null }
}

const FORM_INICIAL = {
    empleadoId: '',
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'APERCIBIMIENTO',
    motivo: '',
    observaciones: '',
}

export function SancionesModal({ isOpen, onClose, empleados }: SancionesModalProps) {
    const [sanciones, setSanciones] = useState<SancionListado[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [newSancion, setNewSancion] = useState(FORM_INICIAL)

    const fetchSanciones = async () => {
        const res = await fetch('/api/empleados/sanciones')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'No se pudo cargar el historial de sanciones.')
        setSanciones(Array.isArray(data) ? data : [])
    }

    useEffect(() => {
        if (!isOpen) return
        setError('')
        void fetchSanciones().catch(err => setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.'))
    }, [isOpen])

    const handleSubmitSancion = async (event: React.FormEvent) => {
        event.preventDefault()
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/empleados/sanciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSancion),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'No se pudo registrar la sanción.')
            setShowForm(false)
            setNewSancion({ ...FORM_INICIAL, fecha: new Date().toISOString().split('T')[0] })
            await fetchSanciones()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo registrar la sanción.')
        } finally {
            setLoading(false)
        }
    }

    const handlePrintSancion = async (sancion: SancionListado) => {
        const fecha = new Date(sancion.fecha)
        const fechaTexto = new Intl.DateTimeFormat('es-AR', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Buenos_Aires',
        }).format(fecha)
        const { logo } = await getPrintLogos()
        const ventana = window.open('', '_blank')
        if (!ventana) {
            setError('El navegador bloqueó la ventana de impresión.')
            return
        }
        ventana.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escaparHtml(sancion.tipo)}</title><style>
            @page{size:A4 portrait;margin:15mm}body{font-family:'Times New Roman',serif;line-height:1.45;color:#111;font-size:12pt}
            header{text-align:center;border-bottom:1px solid #111;padding-bottom:14px;margin-bottom:24px}header img{height:60px}.titulo{font-size:17pt;font-weight:700;text-decoration:underline;margin-top:8px}
            .fecha{text-align:right;margin-bottom:24px}.contenido{text-align:justify}.detalle{padding:12px;border:1px solid #ddd;background:#fafafa;white-space:pre-wrap}
            .firmas{display:flex;justify-content:space-between;margin-top:80px}.firma{width:240px;border-top:1px solid #111;text-align:center;padding-top:8px}
            footer{margin-top:48px;padding-top:10px;border-top:1px dashed #bbb;color:#666;font-size:9pt}
        </style></head><body><header><img src="${logo}" alt="Santa Catalina"><div>Gestión de Recursos Humanos</div><div class="titulo">${escaparHtml(sancion.tipo)}</div></header>
        <div class="fecha">Berazategui, ${escaparHtml(fechaTexto)}</div><div class="contenido"><p>Por medio de la presente, se notifica formalmente al Sr./Sra. <strong>${escaparHtml(sancion.empleado.nombre)} ${escaparHtml(sancion.empleado.apellido || '')}</strong>, con DNI <strong>${escaparHtml(sancion.empleado.dni || '________')}</strong>, que se ha resuelto aplicar la siguiente medida disciplinaria: <strong>${escaparHtml(sancion.tipo)}</strong>.</p>
        <p><strong>Motivo de la medida:</strong></p><div class="detalle">${escaparHtml(sancion.motivo)}${sancion.observaciones ? `<br><br><strong>Observaciones:</strong><br>${escaparHtml(sancion.observaciones)}` : ''}</div>
        <p>Se deja constancia de que esta medida quedará registrada en el legajo personal. La reiteración de conductas similares podrá dar lugar a medidas de mayor severidad.</p></div>
        <div class="firmas"><div class="firma">Firma del Empleador / Responsable</div><div class="firma">Firma del Empleado<br>Aclaración / DNI</div></div>
        <footer>Documento interno generado por el sistema administrativo Santa Catalina.<br>ID de registro: ${escaparHtml(sancion.id)}</footer>
        <script>window.onload=()=>{const i=[...document.images];Promise.all(i.map(x=>x.complete?Promise.resolve():new Promise(r=>{x.onload=r;x.onerror=r}))).then(()=>window.print())}<\/script></body></html>`)
        ventana.document.close()
    }

    if (!isOpen) return null

    return <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: 920, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
                <div><div style={{ color: 'var(--color-primary)', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>Gestión manual</div><h2 style={{ marginTop: 4 }}>Sanciones y apercibimientos</h2></div>
                <button onClick={onClose} className="btn-close" aria-label="Cerrar">&times;</button>
            </div>

            <div className="alert alert-info" style={{ margin: '0 var(--space-4) var(--space-4)' }}>
                Las sanciones se emiten únicamente de forma manual. Las fichadas, tardanzas e inasistencias nunca generan una sanción por sí solas.
            </div>
            {error && <div className="alert alert-danger" role="alert" style={{ margin: '0 var(--space-4) var(--space-4)' }}>{error}</div>}

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '0 var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <div><h3 style={{ margin: 0 }}>Historial registrado</h3><small style={{ color: 'var(--color-gray-500)' }}>{sanciones.length} documento{sanciones.length === 1 ? '' : 's'} en legajos</small></div>
                    <button className="btn btn-primary" onClick={() => setShowForm(actual => !actual)}>{showForm ? 'Cancelar' : '+ Emitir sanción manual'}</button>
                </div>

                {showForm && <form onSubmit={handleSubmitSancion} className="card shadow-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
                        <label className="form-group"><span className="form-label">Empleado</span><select className="form-select" value={newSancion.empleadoId} onChange={e => setNewSancion({ ...newSancion, empleadoId: e.target.value })} required><option value="">Seleccionar…</option>{empleados.map(empleado => <option key={empleado.id} value={empleado.id}>{nombreEmpleadoApellidoPrimero(empleado)}</option>)}</select></label>
                        <label className="form-group"><span className="form-label">Fecha</span><input type="date" className="form-input" value={newSancion.fecha} onChange={e => setNewSancion({ ...newSancion, fecha: e.target.value })} required /></label>
                        <label className="form-group"><span className="form-label">Tipo</span><select className="form-select" value={newSancion.tipo} onChange={e => setNewSancion({ ...newSancion, tipo: e.target.value })}><option value="APERCIBIMIENTO">Apercibimiento</option><option value="SANCION">Sanción</option><option value="SUSPENSION">Suspensión</option><option value="DESPIDO">Despido (aviso)</option></select></label>
                    </div>
                    <label className="form-group"><span className="form-label">Motivo</span><input className="form-input" value={newSancion.motivo} onChange={e => setNewSancion({ ...newSancion, motivo: e.target.value })} placeholder="Describí el hecho concreto que motiva la medida" required /></label>
                    <label className="form-group"><span className="form-label">Observaciones adicionales</span><textarea className="form-input" rows={3} value={newSancion.observaciones} onChange={e => setNewSancion({ ...newSancion, observaciones: e.target.value })} /></label>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando…' : 'Confirmar sanción manual'}</button></div>
                </form>}

                <div className="table-container"><table className="table"><thead><tr><th>Fecha</th><th>Empleado</th><th>Tipo</th><th>Motivo</th><th>Origen</th><th>Acción</th></tr></thead><tbody>
                    {sanciones.map(sancion => <tr key={sancion.id}><td>{format(new Date(sancion.fecha), 'dd/MM/yyyy')}</td><td style={{ fontWeight: 600 }}>{nombreEmpleadoApellidoPrimero(sancion.empleado)}</td><td><span className={`badge badge-${sancion.tipo === 'APERCIBIMIENTO' ? 'warning' : 'danger'}`}>{sancion.tipo}</span></td><td style={{ fontSize: 13 }}>{sancion.motivo}</td><td>{sancion.alertaId ? <span className="badge badge-neutral" title="Registro histórico; la automatización ya está desactivada">Automática histórica</span> : <span className="badge badge-info">Manual</span>}</td><td><button className="btn btn-ghost btn-sm" onClick={() => void handlePrintSancion(sancion)} title="Imprimir para firma">🖨 Imprimir</button></td></tr>)}
                    {sanciones.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>No hay sanciones registradas.</td></tr>}
                </tbody></table></div>
            </div>
        </div>
        <style jsx>{`
            .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:2000;backdrop-filter:blur(4px)}
            .modal-content{background:#fff;border-radius:var(--radius-xl);box-shadow:var(--shadow-2xl);padding:var(--space-6);color:var(--color-gray-900)}
            @media(max-width:720px){.modal-content{padding:var(--space-4)}form>div{grid-template-columns:1fr!important}}
        `}</style>
    </div>
}
