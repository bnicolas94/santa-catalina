"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { VehiculoDialog } from '@/components/flota/VehiculoDialog'

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editVehiculo, setEditVehiculo] = useState<any>(null)

  const fetchVehiculos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/flota/vehiculos')
      const data = await res.json()
      setVehiculos(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehiculos()
  }, [])

  const filtered = Array.isArray(vehiculos) ? vehiculos.filter(v => 
    v.patente?.toLowerCase().includes(search.toLowerCase()) ||
    v.marca?.toLowerCase().includes(search.toLowerCase()) ||
    v.modelo?.toLowerCase().includes(search.toLowerCase())
  ) : []

  const getAlertasVehiculo = (v: any) => {
    let alertas: { grave: boolean, msj: string }[] = []
    const hoy = new Date()
    
    v.vencimientos?.forEach((venc: any) => {
      const fecha = new Date(venc.fechaVencimiento)
      const diasAviso = venc.diasAviso || 30
      const limite = new Date(fecha)
      limite.setDate(fecha.getDate() - diasAviso)
      if (fecha < hoy) alertas.push({ grave: true, msj: `${venc.tipo} Vencido` })
      else if (hoy >= limite) alertas.push({ grave: false, msj: `${venc.tipo} en <${diasAviso}d` })
    })

    if (v.kmProximoService) {
      const faltan = v.kmProximoService - v.kmActual
      const aviso = v.avisoKmsAntes || 2000
      if (faltan <= 0) alertas.push({ grave: true, msj: `Service Pasado` })
      else if (faltan <= aviso) alertas.push({ grave: false, msj: `Service en ${faltan}km` })
    }
    return alertas
  }

  const handleSave = async (data: any) => {
    const url = editVehiculo ? `/api/flota/vehiculos/${editVehiculo.id}` : '/api/flota/vehiculos'
    const method = editVehiculo ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al guardar el vehículo')
    }

    setShowDialog(false)
    setEditVehiculo(null)
    fetchVehiculos()
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Gestión de Vehículos</h1>
        <div className="page-actions">
          <Link href="/logistica/flota" className="btn btn-ghost">← Volver al Dashboard</Link>
          <button 
            className="btn btn-primary"
            onClick={() => { setEditVehiculo(null); setShowDialog(true); }}
          >
            + Nuevo Vehículo
          </button>
        </div>
      </div>

      <div className="filters-container">
        <input 
          type="text" 
          placeholder="Buscar patente, marca, modelo..." 
          className="form-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      {loading ? (
        <p>Cargando vehículos...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Patente</th>
                <th>Marca / Modelo / Año</th>
                <th>KM Actual</th>
                <th>Estado</th>
                <th>Alertas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 'bold' }}>{v.patente}</td>
                  <td>{v.marca} {v.modelo} ({v.anio})</td>
                  <td>{v.kmActual.toLocaleString()} km</td>
                  <td>
                    <span className={`badge badge-${v.estado === 'disponible' ? 'success' : v.estado === 'taller' ? 'warning' : 'danger'}`}>
                      {v.estado.toUpperCase()}
                    </span>
                    {!v.activo && <span className="badge badge-danger" style={{ marginLeft: '4px' }}>INACTIVO</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {getAlertasVehiculo(v).length > 0 ? (
                        getAlertasVehiculo(v).map((alerta, idx) => (
                          <span key={idx} className={`badge badge-${alerta.grave ? 'danger' : 'warning'}`} style={{ fontSize: '0.7rem' }}>
                            {alerta.grave ? '🛑' : '⚠️'} {alerta.msj}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--color-gray-500)', fontSize: '0.8rem' }}>Todo al día</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Link href={`/logistica/flota/vehiculos/${v.id}`} className="btn btn-ghost btn-sm">
                      Ver Ficha
                    </Link>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setEditVehiculo(v); setShowDialog(true); }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>No hay vehículos registrados o encontrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && (
        <VehiculoDialog 
          vehiculo={editVehiculo} 
          onSave={handleSave} 
          onClose={() => { setShowDialog(false); setEditVehiculo(null); }} 
        />
      )}
    </div>
  )
}
