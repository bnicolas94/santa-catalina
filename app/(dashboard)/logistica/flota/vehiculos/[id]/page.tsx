"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { KmDialog } from '@/components/flota/KmDialog'
import { VencimientoDialog } from '@/components/flota/VencimientoDialog'
import { MantenimientoDialog } from '@/components/flota/MantenimientoDialog'

export default function VehiculoDetallePage() {
  const params = useParams()
  const [vehiculo, setVehiculo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const [showKmDialog, setShowKmDialog] = useState(false)
  const [showVencDialog, setShowVencDialog] = useState(false)
  const [editVenc, setEditVenc] = useState<any>(null)
  const [showMantDialog, setShowMantDialog] = useState(false)
  const [editMant, setEditMant] = useState<any>(null)

  const fetchVehiculo = async () => {
    try {
      const res = await fetch(`/api/flota/vehiculos/${params.id}`)
      if (!res.ok) throw new Error('No encontrado')
      const data = await res.json()
      setVehiculo(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehiculo()
  }, [params.id])

  const getAlertasVehiculo = (v: any) => {
    if (!v) return []
    let alertas: { grave: boolean, msj: string }[] = []
    const hoy = new Date()
    
    v.vencimientos?.forEach((venc: any) => {
      if (venc.kmVencimiento) {
        const faltan = venc.kmVencimiento - v.kmActual
        const aviso = venc.kmAviso || 2000
        if (faltan <= 0) alertas.push({ grave: true, msj: `${venc.tipo} Pasado (${Math.abs(faltan)}km)` })
        else if (faltan <= aviso) alertas.push({ grave: false, msj: `${venc.tipo} próximo en ${faltan}km` })
      } else if (venc.fechaVencimiento) {
        const fecha = new Date(venc.fechaVencimiento)
        const diasAviso = venc.diasAviso || 30
        const limite = new Date(fecha)
        limite.setDate(fecha.getDate() - diasAviso)
        if (fecha < hoy) alertas.push({ grave: true, msj: `${venc.tipo} Vencido` })
        else if (hoy >= limite) alertas.push({ grave: false, msj: `${venc.tipo} vence en breve` })
      }
    })

    if (v.kmProximoService) {
      const faltan = v.kmProximoService - v.kmActual
      const aviso = v.avisoKmsAntes || 2000
      if (faltan <= 0) alertas.push({ grave: true, msj: `Service Obligatorio Pasado (por ${Math.abs(faltan)}km)` })
      else if (faltan <= aviso) alertas.push({ grave: false, msj: `Service próximo en ${faltan}km` })
    }
    return alertas
  }

  const alertas = getAlertasVehiculo(vehiculo)

  const handleSaveKm = async (data: any) => {
    const res = await fetch('/api/flota/kilometrajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, vehiculoId: vehiculo.id }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al guardar KM')
    }
    setShowKmDialog(false)
    fetchVehiculo()
  }

  const handleSaveVencimiento = async (data: any) => {
    const url = editVenc ? `/api/flota/vencimientos/${editVenc.id}` : '/api/flota/vencimientos'
    const method = editVenc ? 'PUT' : 'POST'
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, vehiculoId: vehiculo.id }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al guardar vencimiento')
    }
    setShowVencDialog(false)
    setEditVenc(null)
    fetchVehiculo()
  }

  const handleDeleteVencimiento = async (id: string) => {
    if (!confirm('¿Eliminar este vencimiento?')) return
    await fetch(`/api/flota/vencimientos/${id}`, { method: 'DELETE' })
    fetchVehiculo()
  }

  const handleSaveMantenimiento = async (data: any) => {
    const url = editMant ? `/api/flota/mantenimientos/${editMant.id}` : '/api/flota/mantenimientos'
    const method = editMant ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, vehiculoId: vehiculo.id }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al guardar mantenimiento')
    }
    setShowMantDialog(false)
    setEditMant(null)
    fetchVehiculo()
  }

  const handleDeleteMantenimiento = async (id: string) => {
    if (!confirm('¿Eliminar este mantenimiento?')) return
    await fetch(`/api/flota/mantenimientos/${id}`, { method: 'DELETE' })
    fetchVehiculo()
  }

  if (loading) return <div className="page-content"><p>Cargando ficha del vehículo...</p></div>
  if (!vehiculo) return <div className="page-content"><p>Vehículo no encontrado.</p><Link href="/logistica/flota/vehiculos">Volver</Link></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">
          Ficha: {vehiculo.patente} <span style={{ fontSize: '1rem', color: '#666' }}>{vehiculo.marca} {vehiculo.modelo} ({vehiculo.anio})</span>
        </h1>
        <div className="page-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link href="/logistica/flota/gastos" className="btn btn-outline">💰 Cargar Gasto</Link>
          <Link href="/logistica/flota/vehiculos" className="btn btn-ghost">← Volver</Link>
        </div>
      </div>

      {alertas.length > 0 && (
        <div style={{ backgroundColor: alertas.some(a => a.grave) ? 'var(--color-danger-light)' : 'var(--color-warning-light)', borderLeft: `4px solid ${alertas.some(a => a.grave) ? 'var(--color-danger)' : 'var(--color-warning)'}`, padding: 'var(--space-4)', marginBottom: 'var(--space-6)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ color: alertas.some(a => a.grave) ? 'var(--color-danger-dark)' : 'var(--color-warning-dark)', fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>
            Atención requerida
          </h3>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
            {alertas.map((alerta, idx) => (
              <li key={idx} style={{ color: alerta.grave ? 'var(--color-danger)' : 'var(--color-warning-dark)', fontWeight: alerta.grave ? 'bold' : 'normal' }}>
                {alerta.grave ? '🛑' : '⚠️'} {alerta.msj}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: 'var(--space-6)' }}>
        {/* Info Lateral */}
        <div>
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: 'var(--space-2)' }}>Info General</h2>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--space-3)' }}>
              <li style={{ marginBottom: 'var(--space-2)' }}><strong>Patente:</strong> <span style={{ fontSize: 'var(--text-xl)', background: '#000', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{vehiculo.patente}</span></li>
              <li style={{ marginBottom: 'var(--space-2)' }}><strong>Marca / Modelo:</strong> {vehiculo.marca} {vehiculo.modelo}</li>
              <li style={{ marginBottom: 'var(--space-2)' }}><strong>Año:</strong> {vehiculo.anio}</li>
              <li style={{ marginBottom: 'var(--space-2)' }}><strong>Estado:</strong> <span className="badge badge-success">{vehiculo.estado.toUpperCase()}</span></li>
              <li style={{ marginBottom: 'var(--space-2)' }}><strong>KM Actual:</strong> <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>{vehiculo.kmActual.toLocaleString()} km</span></li>
            </ul>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
              onClick={() => setShowKmDialog(true)}
            >
              Cargar Nuevo KM
            </button>
          </div>
        </div>

        {/* Tablas de Historial */}
        <div>
          {/* Vencimientos */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Vencimientos (VTV, Seguro, etc)</h2>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditVenc(null); setShowVencDialog(true); }}>+ Agregar</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiculo.vencimientos?.length > 0 ? (
                    vehiculo.vencimientos.map((v: any) => {
                      const isVencido = v.kmVencimiento 
                        ? (v.kmVencimiento <= vehiculo.kmActual) 
                        : (new Date(v.fechaVencimiento) < new Date());
                      
                      return (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 'bold' }}>{v.tipo}</td>
                          <td>
                            {v.kmVencimiento 
                              ? `${v.kmVencimiento.toLocaleString()} km` 
                              : new Date(v.fechaVencimiento).toLocaleDateString()}
                          </td>
                          <td>
                            <span className={`badge badge-${isVencido ? 'danger' : 'success'}`}>
                              {isVencido ? (v.kmVencimiento ? 'ALCANZADO' : 'VENCIDO') : 'VIGENTE'}
                            </span>
                          </td>
                          <td>{v.observaciones || '-'}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditVenc(v); setShowVencDialog(true); }}>Editar</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteVencimiento(v.id)}>Eliminar</button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>No hay vencimientos cargados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gastos y Mantenimientos */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Historial de Gastos y Mantenimientos</h2>
              <Link href={`/logistica/flota/gastos?vehiculoId=${vehiculo.id}`} className="btn btn-primary btn-sm">+ Cargar Nuevo</Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Taller</th>
                    <th>KM</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiculo.gastos?.length > 0 ? (
                    vehiculo.gastos.map((g: any) => (
                      <tr key={g.id}>
                        <td>{new Date(g.fecha).toLocaleDateString()}</td>
                        <td>
                          <span className="badge badge-outline">
                            {g.categoria?.nombre}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--text-sm)' }}>{g.descripcion}</td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{g.taller || '-'}</td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{g.kmVehiculo ? `${g.kmVehiculo.toLocaleString()} km` : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                           ${g.monto.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>No hay gastos o mantenimientos registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial KM */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Últimas Cargas de Kilometraje</h2>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Kilometraje</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiculo.kilometrajes?.length > 0 ? (
                    vehiculo.kilometrajes.map((k: any) => (
                      <tr key={k.id}>
                        <td>{new Date(k.fecha).toLocaleString()}</td>
                        <td style={{ fontWeight: 'bold' }}>{k.kmRegistrado.toLocaleString()} km</td>
                        <td>{k.observaciones || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} style={{ textAlign: 'center' }}>No hay historial</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showKmDialog && (
        <KmDialog 
          kmActual={vehiculo.kmActual} 
          onSave={handleSaveKm} 
          onClose={() => setShowKmDialog(false)} 
        />
      )}

      {showVencDialog && (
        <VencimientoDialog 
          vencimiento={editVenc} 
          onSave={handleSaveVencimiento} 
          onClose={() => { setShowVencDialog(false); setEditVenc(null); }} 
        />
      )}

      {showMantDialog && (
        <MantenimientoDialog 
          mantenimiento={editMant} 
          onSave={handleSaveMantenimiento} 
          onClose={() => { setShowMantDialog(false); setEditMant(null); }} 
        />
      )}
    </div>
  )
}
