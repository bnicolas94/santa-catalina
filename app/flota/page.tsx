"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function FlotaDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flota/dashboard')
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="page-content"><p>Cargando dashboard de flota...</p></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Dashboard de Flota</h1>
        <div className="page-actions">
          <Link href="/flota/vehiculos" className="btn btn-primary">
            Ver Vehículos
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Total Vehículos</h3>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold' }}>{stats?.totalVehiculos || 0}</p>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Vehículos Activos</h3>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>{stats?.vehiculosActivos || 0}</p>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Vencimientos OK</h3>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>{stats?.vencimientosStats?.ok || 0}</p>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Próximos a Vencer (30d)</h3>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', color: 'var(--color-warning)' }}>{stats?.vencimientosStats?.proximosVencer || 0}</p>
        </div>
        <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Vencidos</h3>
          <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', color: 'var(--color-danger)' }}>{stats?.vencimientosStats?.vencidos || 0}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Top 5 Alertas de Vencimientos</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Tipo</th>
                <th>Fecha Vencimiento</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats?.alertas?.length > 0 ? (
                stats.alertas.map((a: any) => {
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 'bold' }}>{a.vehiculo?.patente}</td>
                      <td>{a.tipo === 'km' ? 'Mantenimiento (KM)' : 'Documentación'}</td>
                      <td>{a.titulo}</td>
                      <td>
                        <span className={`badge badge-${a.gravedad === 'roja' ? 'danger' : 'warning'}`}>
                          {a.gravedad === 'roja' ? 'CRÍTICO' : 'PRÓXIMO'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/flota/vehiculos/${a.vehiculo?.id}`} className="btn btn-ghost btn-sm">
                          Ver Detalle
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                    ¡No hay alertas pendientes! Tienes tu flota al día.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
