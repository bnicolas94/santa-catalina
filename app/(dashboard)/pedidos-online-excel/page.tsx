'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'

type Resumen = {
    config: { activo: boolean; workbookName: string; activadoEn: string | null }
    conteos: Record<string, number>
    dispositivoConfigurado: boolean
    lectura: { fecha: string; error: string | null } | null
    recientes: { id: string; externalId: string; sourceRow: number; state: string; operation: string | null; lastError: string | null; updatedAt: string }[]
}

async function cargar(url: string): Promise<Resumen> {
    const respuesta = await fetch(url, { cache: 'no-store' })
    const datos = await respuesta.json()
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar la integración.')
    return datos
}

export default function PedidosOnlineExcelPage() {
    const { data, error: errorCarga, mutate } = useSWR('/api/pedidos-online-excel', cargar, { refreshInterval: 10000 })
    const [destino, setDestino] = useState('Pedidos Santa Catalina ultimo - Copia.xlsx')
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [token, setToken] = useState('')
    const workbookName = data?.config.workbookName
    useEffect(() => { if (workbookName) setDestino(workbookName) }, [workbookName])

    async function accion(action: string, id?: string) {
        setOcupado(true); setError(''); setMensaje('')
        try {
            const respuesta = await fetch('/api/pedidos-online-excel', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }),
            })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la acción.')
            if (action === 'token') setToken(datos.token)
            else if (action === 'prueba') setMensaje(`Prueba encolada: ${datos.externalId}`)
            else setMensaje(`Acción ${action} completada.`)
            await mutate()
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción.') }
        finally { setOcupado(false) }
    }

    async function guardarDestino() {
        setOcupado(true); setError(''); setMensaje('')
        try {
            const respuesta = await fetch('/api/pedidos-online-excel', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workbookName: destino }),
            })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo guardar el destino.')
            await mutate(); setMensaje('Destino guardado.')
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') }
        finally { setOcupado(false) }
    }

    const esCopia = data?.config.workbookName.includes(' - Copia.xlsx')
    return <main style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
        <h1>Pedidos online → Excel</h1>
        <p>Pedidos nuevos de la modalidad Delivery. El ERP prepara las operaciones y el complemento las aplica al libro abierto.</p>
        {errorCarga && <p role="alert">{errorCarga.message}</p>}
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        {mensaje && <p role="status">{mensaje}</p>}
        {data && <>
            <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h2>Destino y activación</h2>
                <p>Estado: <strong>{data.config.activo ? 'Activa' : 'Pausada'}</strong>. Inicio: {data.config.activadoEn ? new Date(data.config.activadoEn).toLocaleString('es-AR') : 'sin activar'}.</p>
                <label htmlFor="destino-excel">Libro de destino</label>{' '}
                <select id="destino-excel" value={destino} disabled={ocupado || data.config.activo} onChange={e => setDestino(e.target.value)}>
                    <option>Pedidos Santa Catalina ultimo - Copia.xlsx</option>
                    <option>Pedidos Santa Catalina ultimo.xlsx</option>
                </select>{' '}
                <button disabled={ocupado || data.config.activo || destino === data.config.workbookName} onClick={guardarDestino}>Guardar destino</button>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button disabled={ocupado || data.config.activo} onClick={() => accion('activar')}>Activar desde ahora</button>
                    <button disabled={ocupado || !data.config.activo} onClick={() => accion('desactivar')}>Pausar</button>
                    <button disabled={ocupado || !data.config.activo} onClick={() => accion('sincronizar')}>Leer Google ahora</button>
                </div>
                <p>Al activar, los IDs que ya están en Google se registran como anteriores y no se cargan.</p>
            </section>
            <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h2>Complemento de Excel</h2>
                <p>Descargá el <a href="/office-pedidos/manifest.xml" download="santa-catalina-pedidos-online.xml">manifiesto del complemento</a> y agregalo al Excel del destino mediante una carpeta compartida de confianza. Luego pegá allí la clave generada. Ver <a href="https://learn.microsoft.com/office/dev/add-ins/testing/create-a-network-shared-folder-catalog-for-task-pane-and-content-add-ins" target="_blank" rel="noreferrer">instrucciones de Microsoft</a>.</p>
                <button disabled={ocupado} onClick={() => accion('token')}>{data.dispositivoConfigurado ? 'Renovar clave' : 'Generar clave'}</button>
                {token && <div style={{ marginTop: 12 }}><p>La clave se muestra una sola vez. Copiala al complemento:</p><code style={{ overflowWrap: 'anywhere' }}>{token}</code></div>}
                <p>Al renovar la clave, la anterior deja de funcionar.</p>
            </section>
            {esCopia && <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h2>Prueba en la copia</h2>
                <p>La prueba crea un pedido ficticio. Después de verlo en Excel, usá «Cancelar prueba» para quitarlo.</p>
                <button disabled={ocupado || !data.config.activo} onClick={() => accion('prueba')}>Crear pedido de prueba</button>
            </section>}
            <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
                <h2>Estado</h2>
                <p>Última lectura de Google: {data.lectura ? new Date(data.lectura.fecha).toLocaleString('es-AR') : 'sin lecturas'}.
                    {data.lectura?.error && <span style={{ color: '#b91c1c' }}> Error: {data.lectura.error}</span>}</p>
                <p>{Object.entries(data.conteos).map(([clave, valor]) => `${clave}: ${valor}`).join(' · ') || 'Sin pedidos registrados'}</p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th>ID Google</th><th>Estado</th><th>Operación</th><th>Detalle</th><th>Acción</th></tr></thead>
                    <tbody>{data.recientes.map(fila => <tr key={fila.id}>
                        <td>{fila.externalId}</td><td>{fila.state}</td><td>{fila.operation || '—'}</td><td>{fila.lastError || '—'}</td>
                        <td>{fila.externalId.startsWith('PRUEBA-') && fila.state !== 'CANCELADO' && esCopia
                            ? <button disabled={ocupado || !data.config.activo} onClick={() => accion('cancelar-prueba', fila.id)}>Cancelar prueba</button>
                            : fila.state === 'ERROR' && fila.operation
                                ? <button disabled={ocupado} onClick={() => accion('reintentar', fila.id)}>Reintentar</button>
                                : null}</td>
                    </tr>)}</tbody>
                </table>
            </section>
        </>}
    </main>
}
