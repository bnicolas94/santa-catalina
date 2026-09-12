'use client'
import { useState } from 'react'

interface Fila {
    id: string; monto: number; fecha: string; error: string | null
    candidatos: { id: string; monto: number; fecha: string; concepto: string; descripcion: string | null }[]
}
interface Preview { resultados: Fila[]; token: string; totalReporte: number }
const moneda = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export default function ConciliarReporteMP({ onConfirmado, automaticos = false }: { onConfirmado: () => void; automaticos?: boolean }) {
    const [abierto, setAbierto] = useState(false)
    const [csv, setCsv] = useState('')
    const [preview, setPreview] = useState<Preview | null>(null)
    const [seleccion, setSeleccion] = useState<Record<string, string>>({})
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [revisado, setRevisado] = useState(false)
    const decisiones = (preview?.resultados || []).filter(f => !f.error && seleccion[f.id] && seleccion[f.id] !== 'omitir')
        .map(f => ({ id: f.id, accion: seleccion[f.id] === 'crear' ? 'crear' : 'vincular', movimientoId: seleccion[f.id] === 'crear' ? undefined : seleccion[f.id] }))
    const nuevos = decisiones.filter(d => d.accion === 'crear')
    const total = nuevos.reduce((s, d) => s + Math.round((preview?.resultados.find(f => f.id === d.id)?.monto || 0) * 100), 0) / 100

    async function enviar(confirmar: boolean) {
        setOcupado(true); setError(''); setMensaje('')
        if (!confirmar) { setPreview(null); setSeleccion({}); setRevisado(false) }
        try {
            const response = await fetch('/api/mercadopago/reporte', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(confirmar ? { accion: 'confirmar', token: preview?.token, decisiones } : automaticos ? { accion: 'pendientes' } : { accion: 'preview', csv }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'No se pudo procesar el reporte.')
            if (confirmar) {
                setMensaje(`${data.creados} egresos incorporados, ${data.vinculados} vinculados sin descuento y ${data.yaRegistrados} ya registrados. Descuento aplicado: ${moneda(data.descontado)}.`)
                setPreview(null); setSeleccion({}); setRevisado(false); onConfirmado()
            } else { setPreview(data); setSeleccion({}); setRevisado(false) }
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación.') }
        finally { setOcupado(false) }
    }

    return <>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAbierto(true); if (automaticos) void enviar(false) }}>{automaticos ? 'Revisar pendientes automáticos' : 'Conciliar reporte MP'}</button>
        {abierto && <div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-conciliar-mp" style={{ maxWidth: 1050, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 id="titulo-conciliar-mp">{automaticos ? 'Revisar egresos pendientes de MP' : 'Conciliar egresos desde el reporte de MP'}</h2>
            {automaticos ? <p>Estos egresos se descargaron automáticamente. Revisá las coincidencias con cargas manuales; cada lote muestra hasta 30 operaciones de un mismo reporte.</p> : <>
            <p>Seleccioná el CSV de la cuenta conectada. La vista previa verifica hasta 30 egresos con MP sin modificar Caja; admite fechas anteriores a las últimas 48 horas.</p>
            <input type="file" accept=".csv" aria-label="Reporte de egresos MP" disabled={ocupado} onChange={async e => {
                const archivo = e.target.files?.[0]
                setCsv(''); setPreview(null); setSeleccion({}); setRevisado(false); setError(''); setMensaje('')
                if (!archivo) return
                setOcupado(true)
                try {
                    if (archivo.size > 2 * 1024 * 1024) throw new Error('El archivo debe ser menor a 2 MB.')
                    setCsv(await archivo.text())
                } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo leer el CSV.') }
                finally { setOcupado(false) }
            }} />
            <button type="button" className="btn btn-primary" disabled={ocupado || !csv} onClick={() => void enviar(false)}>{ocupado ? 'Procesando…' : 'Generar vista previa'}</button>
            </>}
            {automaticos && <button type="button" className="btn btn-primary" disabled={ocupado} onClick={() => void enviar(false)}>{ocupado ? 'Verificando…' : 'Actualizar pendientes'}</button>}
            {error && <p role="alert" style={{ color: '#dc2626' }}>{error}</p>}
            {mensaje && <p role="status">{mensaje}</p>}
            {preview && <>
                <p>{preview.resultados.length} egresos en el reporte por {moneda(preview.totalReporte)}. Revisá posibles pagos manuales antes de confirmar: las coincidencias sugeridas buscan el mismo importe en Caja Mercado Pago dentro de ±3 días y no detectan pagos agrupados ni fechas más alejadas.</p>
                <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Pago MP / fecha Argentina</th><th>Importe</th><th>Verificación y coincidencias</th><th>Acción</th></tr></thead><tbody>
                    {preview.resultados.map(f => <tr key={f.id}>
                        <td>{f.id}<br />{new Date(f.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td>
                        <td>{moneda(f.monto)}</td>
                        <td>{f.error || (f.candidatos.length ? 'Posibles movimientos ya cargados:' : 'Verificado con MP. Sin coincidencias en la búsqueda.')}
                            {f.candidatos.map(c => <p key={c.id}>{c.concepto} · {new Date(c.fecha).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} · {c.descripcion || 'Sin descripción'}</p>)}
                        </td>
                        <td><select className="form-select" aria-label={`Acción para pago ${f.id}`} disabled={ocupado || Boolean(f.error)} value={seleccion[f.id] || 'omitir'} onChange={e => { setSeleccion({ ...seleccion, [f.id]: e.target.value }); setRevisado(false) }}>
                            <option value="omitir">Omitir</option>
                            {!f.candidatos.length && !f.error && <option value="crear">Incorporar y descontar</option>}
                            {f.candidatos.map(c => <option key={c.id} value={c.id}>Vincular: {c.concepto} ({c.id.slice(-6)})</option>)}
                        </select></td>
                    </tr>)}
                </tbody></table></div>
                <p><strong>Se descontarán {moneda(total)} por {nuevos.length} egresos nuevos.</strong> Se vincularán {decisiones.length - nuevos.length} sin modificar el saldo.</p>
                <label><input type="checkbox" checked={revisado} disabled={ocupado} onChange={e => setRevisado(e.target.checked)} /> Revisé las cargas manuales y las acciones seleccionadas.</label>
                <p><button type="button" className="btn btn-primary" disabled={ocupado || !revisado || !decisiones.length} onClick={() => void enviar(true)}>Confirmar selección</button></p>
            </>}
            <div className="form-actions"><button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => setAbierto(false)}>Cerrar</button></div>
        </div></div>}
    </>
}
