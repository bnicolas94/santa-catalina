'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { fechaClaveRRHH } from '@/lib/rrhh/fechas'

type Entrega = {
    id: string
    fecha: string
    estado: string
    observaciones: string | null
    remera: number
    buzo: number
    nombreEmpleado: string | null
    dniEmpleado: string | null
    rolEmpleado: string | null
    detalles: { prenda: 'REMERA' | 'BUZO'; talle: string; cantidad: number }[]
    empleado: { nombre: string; apellido: string | null; dni: string | null; rol: string }
}

export default function ImprimirReciboUniforme() {
    const params = useParams()
    const [entrega, setEntrega] = useState<Entrega | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const controlador = new AbortController()
        async function cargar() {
            try {
                const respuesta = await fetch(`/api/empleados/${params.id}/uniformes/entregas/${params.entregaId}`, { signal: controlador.signal })
                const datos = await respuesta.json()
                if (!respuesta.ok) throw new Error(datos.error || 'Entrega no encontrada.')
                setEntrega(datos)
            } catch (fallo) {
                if (!controlador.signal.aborted) setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar el comprobante.')
            } finally {
                if (!controlador.signal.aborted) setLoading(false)
            }
        }
        void cargar()
        return () => controlador.abort()
    }, [params.id, params.entregaId])

    if (loading) return <div style={{ padding: 20 }}>Cargando comprobante...</div>
    if (error || !entrega) return <div role="alert" style={{ padding: 20 }}>{error || 'Entrega no encontrada.'}</div>
    if (entrega.estado === 'ANULADA') return <div role="alert" style={{ padding: 20 }}>Esta entrega fue anulada y no tiene comprobante vigente.</div>

    const [anio, mes, dia] = fechaClaveRRHH(entrega.fecha).split('-')
    const detalles = entrega.detalles.length ? entrega.detalles : [
        ...(entrega.remera > 0 ? [{ prenda: 'REMERA' as const, talle: 'No consta', cantidad: entrega.remera }] : []),
        ...(entrega.buzo > 0 ? [{ prenda: 'BUZO' as const, talle: 'No consta', cantidad: entrega.buzo }] : []),
    ]

    return <main style={{ fontFamily: 'sans-serif', padding: 40, maxWidth: 800, margin: '0 auto', color: '#000' }}>
        <style>{`@media print { @page { margin: 15mm; } body { background: white; } .no-print { display: none !important; } }`}</style>
        <div className="no-print" style={{ textAlign: 'right', marginBottom: 20 }}>
            <button type="button" onClick={() => window.location.assign(`/empleados/${params.id}/uniformes/imprimir`)} style={{ padding: '8px 16px' }}>Abrir constancia SRT 299/11</button>
        </div>
        <section style={{ border: '2px solid #000', padding: 30 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, borderBottom: '2px solid #000', paddingBottom: 20 }}>
                <div><h1 style={{ margin: 0, fontSize: 24 }}>Fábrica de Sándwiches</h1><h2 style={{ fontSize: 18 }}>Recibo de entrega de ropa de trabajo</h2></div>
                <div><strong>Fecha de entrega</strong><p>{dia}/{mes}/{anio}</p></div>
            </header>
            <p><strong>Empleado:</strong> {entrega.nombreEmpleado || `${entrega.empleado.nombre} ${entrega.empleado.apellido || ''}`}</p>
            <p><strong>DNI:</strong> {entrega.nombreEmpleado ? (entrega.dniEmpleado || '—') : (entrega.empleado.dni || '—')}</p>
            <p><strong>Puesto/Rol:</strong> {entrega.rolEmpleado || entrega.empleado.rol}</p>
            <h3>Prendas entregadas</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ border: '1px solid #000', padding: 8 }}>Prenda</th><th style={{ border: '1px solid #000', padding: 8 }}>Talle</th><th style={{ border: '1px solid #000', padding: 8 }}>Cantidad</th></tr></thead>
                <tbody>{detalles.map((item, indice) => <tr key={indice}>
                    <td style={{ border: '1px solid #000', padding: 8 }}>{item.prenda === 'REMERA' ? 'Remera' : 'Buzo'}</td>
                    <td style={{ border: '1px solid #000', padding: 8 }}>{item.talle}</td>
                    <td style={{ border: '1px solid #000', padding: 8 }}>{item.cantidad}</td>
                </tr>)}</tbody>
            </table>
            {entrega.observaciones && <p><strong>Observaciones:</strong> {entrega.observaciones}</p>}
            <p style={{ marginTop: 45, lineHeight: 1.5 }}>Acuso recibo de las prendas detalladas, provistas para su uso durante la jornada laboral.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 50, marginTop: 80 }}>
                <div style={{ width: 220, textAlign: 'center', borderTop: '1px solid #000', paddingTop: 8 }}>Firma del empleado</div>
                <div style={{ width: 220, textAlign: 'center', borderTop: '1px solid #000', paddingTop: 8 }}>Aclaración</div>
            </div>
        </section>
    </main>
}
