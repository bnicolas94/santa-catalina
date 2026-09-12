'use client'
import { useState } from 'react'
import useSWR from 'swr'
import ConciliarReporteMP from './ConciliarReporteMP'

interface Estado {
    configurado: boolean; habilitado: boolean; hasta: string | null; ultimoIntento?: string; ultimaActualizacion?: string
    incorporados: number; pendientes: number; error?: string; esperandoReporte: boolean; procesando: boolean
    incidencias: { id: string; error: string }[]
}
const fecha = (valor: string) => new Date(valor).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
async function consultar(url: string): Promise<Estado> {
    const response = await fetch(url)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudo consultar MP.')
    return data
}

export default function EstadoAutomaticoMP({ onActualizado }: { onActualizado: () => void }) {
    const { data, error, mutate } = useSWR<Estado>('/api/mercadopago/sincronizar', consultar, { refreshInterval: 15000 })
    const [ocupado, setOcupado] = useState(false)
    const [fallo, setFallo] = useState('')
    async function actualizar() {
        setOcupado(true); setFallo('')
        try {
            const response = await fetch('/api/mercadopago/sincronizar', { method: 'POST' })
            const resultado = await response.json()
            if (!response.ok) throw new Error(resultado.error || 'No se pudo actualizar MP.')
            await mutate(resultado); onActualizado()
        } catch (e) { setFallo(e instanceof Error ? e.message : 'No se pudo actualizar MP.') }
        finally { setOcupado(false) }
    }
    const problema = fallo || error?.message || data?.error
    return <>
        <strong>Egresos automáticos</strong>
        <p>Se actualizan desde el servidor, aunque cierres Caja.</p>
        {!data && !error && <p>Consultando estado…</p>}
        {data && <div role="status">
            {!data.habilitado && <p>La ejecución automática está pausada en el servidor.</p>}
            {!data.configurado ? <p>Falta configurar la conexión con MP.</p> : <>
                {data.esperandoReporte && <p>Esperando que MP prepare el reporte.</p>}
                {data.procesando && <p>Incorporando egresos del reporte…</p>}
                <p>{data.incorporados} incorporados automáticamente · {data.pendientes} pendientes de revisión.</p>
                <p>{data.hasta ? `Reporte revisado hasta: ${fecha(data.hasta)}.` : 'Primera actualización pendiente. Se revisan los últimos 7 días.'}</p>
                {data.ultimoIntento && <p>Último intento: {fecha(data.ultimoIntento)}.</p>}
                {data.ultimoIntento && Date.now() - Date.parse(data.ultimoIntento) > 30 * 60000 && <p style={{ color: '#b45309' }}>La actualización está demorada. Revisá la conexión o el servidor.</p>}
            </>}
        </div>}
        {problema && <p role="alert" style={{ color: '#dc2626' }}>{problema}</p>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => void actualizar()}>{ocupado ? 'Consultando…' : 'Consultar actualización MP'}</button>
        {!!data?.pendientes && <>
            <ConciliarReporteMP automaticos onConfirmado={() => { void mutate(); onActualizado() }} />
            <details><summary>Ver motivos pendientes</summary>{data.incidencias.map((p, i) => <p key={`${p.id}-${i}`}>#{p.id}: {p.error}</p>)}</details>
        </>}
    </>
}
