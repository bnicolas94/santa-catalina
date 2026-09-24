'use client'

import { useCallback, useEffect, useState } from 'react'

type Configuracion = {
    empleador: { razonSocial: string; cuit: string } | null
    eppGeneral: string
    establecimientos: { id: string; nombre: string; activo: boolean; datos: { direccion: string; localidad: string; codigoPostal: string; provincia: string } | null }[]
    puestos: { id: string; nombre: string; activo: boolean; eppNecesarios: string }[]
}
type Stock = { id: string; prenda: 'REMERA' | 'BUZO'; talle: string; tipoModelo: string | null; marca: string | null; certificado: boolean | null }

const establecimientoVacio = { direccion: '', localidad: '', codigoPostal: '', provincia: '' }

export function ConfiguracionUniformes() {
    const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
    const [stock, setStock] = useState<Stock[]>([])
    const [razonSocial, setRazonSocial] = useState('')
    const [cuit, setCuit] = useState('')
    const [ubicacionId, setUbicacionId] = useState('')
    const [establecimiento, setEstablecimiento] = useState(establecimientoVacio)
    const [puestoId, setPuestoId] = useState('')
    const [eppNecesarios, setEppNecesarios] = useState('')
    const [stockId, setStockId] = useState('')
    const [tipoModelo, setTipoModelo] = useState('')
    const [marca, setMarca] = useState('')
    const [certificado, setCertificado] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')

    const cargar = useCallback(async () => {
        try {
            const [respuestaConfig, respuestaStock] = await Promise.all([fetch('/api/uniformes/configuracion'), fetch('/api/uniformes/stock')])
            if (!respuestaConfig.ok || !respuestaStock.ok) throw new Error('No se pudo cargar la configuración.')
            const datos = await respuestaConfig.json() as Configuracion
            const prendas = await respuestaStock.json() as Stock[]
            setConfiguracion(datos)
            setStock(prendas)
            setRazonSocial(datos.empleador?.razonSocial || '')
            setCuit(datos.empleador?.cuit || '')
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la configuración.')
        }
    }, [])

    useEffect(() => { void cargar() }, [cargar])
    useEffect(() => {
        const datos = configuracion?.establecimientos.find(item => item.id === ubicacionId)?.datos
        setEstablecimiento(datos || establecimientoVacio)
    }, [configuracion, ubicacionId])
    useEffect(() => {
        setEppNecesarios(puestoId
            ? configuracion?.puestos.find(item => item.id === puestoId)?.eppNecesarios || ''
            : configuracion?.eppGeneral || '')
    }, [configuracion, puestoId])
    useEffect(() => {
        const prenda = stock.find(item => item.id === stockId)
        setTipoModelo(prenda?.tipoModelo || '')
        setMarca(prenda?.marca || '')
        setCertificado(prenda?.certificado === true ? 'SI' : prenda?.certificado === false ? 'NO' : '')
    }, [stock, stockId])

    async function guardar(url: string, datos: object, metodo: 'PUT' = 'PUT') {
        setGuardando(true)
        setError('')
        setMensaje('')
        try {
            const respuesta = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
            const cuerpo = await respuesta.json()
            if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo guardar.')
            await cargar()
            setMensaje('Configuración guardada.')
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar.')
        } finally {
            setGuardando(false)
        }
    }

    if (!configuracion) return <p>{error || 'Cargando configuración...'}</p>

    return <div style={{ display: 'grid', gap: 20 }}>
        <p>Estos datos completan la constancia de la Resolución SRT 299/11. La certificación se informa según el producto efectivamente entregado.</p>
        {error && <div role="alert" className="alert alert-error">{error}</div>}
        {mensaje && <div role="status" className="alert">{mensaje}</div>}
        <form className="card" onSubmit={evento => { evento.preventDefault(); void guardar('/api/uniformes/configuracion', { tipo: 'empleador', razonSocial, cuit }) }}><div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <h3>Empleador</h3>
            <label className="form-control"><span className="label">Razón social completa</span><input className="input" required value={razonSocial} onChange={evento => setRazonSocial(evento.target.value)} /></label>
            <label className="form-control"><span className="label">CUIT</span><input className="input" required inputMode="numeric" value={cuit} onChange={evento => setCuit(evento.target.value)} /></label>
            <div><button type="submit" className="btn btn-primary" disabled={guardando}>Guardar empleador</button></div>
        </div></form>

        <form className="card" onSubmit={evento => { evento.preventDefault(); void guardar('/api/uniformes/configuracion', { tipo: 'establecimiento', ubicacionId, ...establecimiento }) }}><div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <h3>Establecimiento donde trabaja el empleado</h3>
            <label className="form-control"><span className="label">Sede</span><select className="input" required value={ubicacionId} onChange={evento => setUbicacionId(evento.target.value)}><option value="">Seleccionar</option>{configuracion.establecimientos.map(item => <option key={item.id} value={item.id}>{item.nombre}{item.activo ? '' : ' (inactiva)'}</option>)}</select></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {([['direccion', 'Dirección'], ['localidad', 'Localidad'], ['codigoPostal', 'Código postal'], ['provincia', 'Provincia']] as const).map(([campo, etiqueta]) => <label className="form-control" key={campo}><span className="label">{etiqueta}</span><input className="input" required value={establecimiento[campo]} onChange={evento => setEstablecimiento(actual => ({ ...actual, [campo]: evento.target.value }))} /></label>)}
            </div>
            <div><button type="submit" className="btn btn-primary" disabled={guardando || !ubicacionId}>Guardar establecimiento</button></div>
        </div></form>

        <form className="card" onSubmit={evento => { evento.preventDefault(); void guardar('/api/uniformes/configuracion', { tipo: 'epp', puestoId, eppNecesarios }) }}><div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <h3>Elementos de protección necesarios</h3>
            <label className="form-control"><span className="label">Puesto</span><select className="input" value={puestoId} onChange={evento => setPuestoId(evento.target.value)}><option value="">Valor general para puestos sin configuración específica</option>{configuracion.puestos.map(item => <option key={item.id} value={item.id}>{item.nombre}{item.activo ? '' : ' (inactivo)'}</option>)}</select></label>
            <label className="form-control"><span className="label">EPP indicados por Higiene y Seguridad o la ART</span><textarea className="input" required maxLength={1000} value={eppNecesarios} onChange={evento => setEppNecesarios(evento.target.value)} /></label>
            <div><button type="submit" className="btn btn-primary" disabled={guardando}>Guardar EPP requeridos</button></div>
        </div></form>

        <form className="card" onSubmit={evento => { evento.preventDefault(); void guardar(`/api/uniformes/stock/${stockId}`, { tipoModelo, marca, certificado: certificado === 'SI' }) }}><div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <h3>Ficha de producto</h3>
            <label className="form-control"><span className="label">Prenda y talle</span><select className="input" required value={stockId} onChange={evento => setStockId(evento.target.value)}><option value="">Seleccionar</option>{stock.map(item => <option key={item.id} value={item.id}>{item.prenda === 'REMERA' ? 'Remera' : 'Buzo'} · {item.talle}</option>)}</select></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <label className="form-control"><span className="label">Tipo / modelo</span><input className="input" required maxLength={100} value={tipoModelo} onChange={evento => setTipoModelo(evento.target.value)} /></label>
                <label className="form-control"><span className="label">Marca</span><input className="input" required maxLength={100} value={marca} onChange={evento => setMarca(evento.target.value)} /></label>
                <label className="form-control"><span className="label">Posee certificación</span><select className="input" required value={certificado} onChange={evento => setCertificado(evento.target.value)}><option value="">Seleccionar</option><option value="SI">Sí</option><option value="NO">No</option></select></label>
            </div>
            <div><button type="submit" className="btn btn-primary" disabled={guardando || !stockId || !certificado}>Guardar ficha de producto</button></div>
        </div></form>
    </div>
}
