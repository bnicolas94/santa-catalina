'use client'

import { useState } from 'react'

interface Resultado {
    id: string
    consultado: boolean
    motivos: string[]
    montoPagado?: number
    registradoMP: boolean
    caja: { estado: string; monto: number; tipo: string; cajaOrigen: string | null } | null
}

export default function DiagnosticoMercadoPago() {
    const [abierto, setAbierto] = useState(false)
    const [ids, setIds] = useState('')
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const [resultados, setResultados] = useState<Resultado[]>([])

    async function consultar() {
        setOcupado(true); setError(''); setResultados([])
        try {
            const response = await fetch('/api/mercadopago/diagnostico', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: ids.trim().split(/[\s,;]+/).filter(Boolean) }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'No se pudo completar el diagnóstico.')
            setResultados(data.resultados)
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar.') }
        finally { setOcupado(false) }
    }

    return <>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(true)}>Diagnosticar egresos</button>
        {abierto && <div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-diagnostico-mp" style={{ maxWidth: 950, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 id="titulo-diagnostico-mp">Diagnóstico de egresos MP</h2>
            <p>Seleccioná el reporte CSV o pegá hasta 30 IDs. Esta consulta no registra movimientos ni modifica saldos.</p>
            <input type="file" accept=".csv" aria-label="Reporte CSV de Mercado Pago" disabled={ocupado} onChange={async event => {
                const archivo = event.target.files?.[0]
                if (!archivo) return
                setError(''); setResultados([]); setIds(''); setOcupado(true)
                try {
                    if (archivo.size > 2 * 1024 * 1024) throw new Error('El archivo debe ser menor a 2 MB.')
                    const { idsEgresosReporte } = await import('@/lib/mercadopago-diagnostico-input')
                    setIds(idsEgresosReporte(await archivo.text()).join('\n'))
                } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el reporte.') }
                finally { setOcupado(false) }
            }} />
            <textarea className="form-input" aria-label="IDs de egresos" rows={4} value={ids} disabled={ocupado} onChange={event => { setIds(event.target.value); setResultados([]) }} style={{ marginTop: 12 }} />
            {error && <p role="alert" style={{ color: '#dc2626' }}>{error}</p>}
            <div className="form-actions">
                <button type="button" className="btn btn-primary" disabled={ocupado || !ids.trim()} onClick={() => void consultar()}>{ocupado ? 'Consultando…' : 'Consultar sin modificar Caja'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setAbierto(false)}>Cerrar</button>
            </div>
            {resultados.length > 0 && <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <p>{resultados.length} operaciones consultadas. La consulta directa no demuestra que Payments Search incluya el pago. Los registros manuales sin ID de MP requieren conciliación.</p>
                <table className="table"><thead><tr><th>ID MP</th><th>Importe API</th><th>Resultado API y filtros</th><th>Registro ERP</th></tr></thead><tbody>
                    {resultados.map(r => <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>{r.montoPagado === undefined ? 'No disponible' : r.montoPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td>{r.motivos.length ? r.motivos.join('. ') : 'Cumple los filtros actuales; revisar si aparece en la búsqueda.'}</td>
                        <td>{r.caja ? `${r.caja.tipo} ${r.caja.monto.toLocaleString('es-AR')} · ${r.caja.estado} · ${r.caja.cajaOrigen}` : r.registradoMP ? 'Registro MP existente sin vínculo a Caja; la sincronización lo omite.' : 'Sin registro vinculado por ID de MP'}</td>
                    </tr>)}
                </tbody></table>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                    const url = URL.createObjectURL(new Blob([JSON.stringify({ resultados }, null, 2)], { type: 'application/json' }))
                    const enlace = document.createElement('a'); enlace.href = url; enlace.download = 'diagnostico-egresos-mp.json'; enlace.click()
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                }}>Descargar diagnóstico</button>
            </div>}
        </div></div>}
    </>
}
