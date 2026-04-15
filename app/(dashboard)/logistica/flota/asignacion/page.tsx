"use client"

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface Vehiculo {
    id: string
    patente: string
    marca: string
    modelo: string
    alias?: string
    estado: string // disponible, mantenimiento, inactivo
}

interface Chofer {
    id: string
    nombre: string
    apellido: string
}

interface Asignacion {
    id: string
    fecha: string
    turno: string
    empleadoId: string
    vehiculoId: string
    kmInicio?: number
    novedades?: string
    empleado: { nombre: string; apellido: string }
    vehiculo: { patente: string; marca: string; modelo: string; alias?: string }
}

export default function AsignacionFlotaPage() {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
    const [turno, setTurno] = useState('Mañana')
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
    const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Form for new assignment
    const [selectedChofer, setSelectedChofer] = useState('')
    const [selectedVehiculo, setSelectedVehiculo] = useState('')

    useEffect(() => {
        fetchData()
    }, [fecha, turno])

    async function fetchData() {
        setLoading(true)
        try {
            const [pedRes, vehRes, asigRes] = await Promise.all([
                fetch('/api/empleados'),
                fetch('/api/flota/vehiculos'),
                fetch(`/api/logistica/flota/asignaciones?fecha=${fecha}&turno=${turno}`)
            ])
            
            const empData = await pedRes.json()
            const vehData = await vehRes.json()
            const asigData = await asigRes.json()

            // Filter for drivers
            const chofs = Array.isArray(empData) 
                ? empData.filter((e: any) => e.rol === 'LOGISTICA' || e.rol === 'ADMIN')
                : []
            setChoferes(chofs)
            
            // Vehicles available (active and not in maintenance)
            const vems = Array.isArray(vehData) ? vehData.filter((v: any) => v.activo) : []
            setVehiculos(vems)

            setAsignaciones(asigData)
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    async function handleAssign() {
        if (!selectedChofer || !selectedVehiculo) {
            toast.error('Seleccioná chofer y vehículo')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/logistica/flota/asignaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha,
                    turno,
                    empleadoId: selectedChofer,
                    vehiculoId: selectedVehiculo
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            toast.success('Asignación guardada')
            setSelectedChofer('')
            setSelectedVehiculo('')
            fetchData()
        } catch (error: any) {
            toast.error(error.message || 'Error al guardar asignación')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar esta asignación?')) return

        try {
            const res = await fetch(`/api/logistica/flota/asignaciones?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Asignación eliminada')
                fetchData()
            }
        } catch (error) {
            toast.error('Error al eliminar')
        }
    }

    const availableVehiculos = vehiculos.filter(v => 
        !asignaciones.some(a => a.vehiculoId === v.id)
    )

    return (
        <div className="page-content">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Asignación Diaria de Flota</h1>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>
                        Control de qué vehículo usa cada chofer por día y turno.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <input type="date" className="form-input" value={fecha} onChange={e => setFecha(e.target.value)} />
                    <select className="form-select" value={turno} onChange={e => setTurno(e.target.value)}>
                        <option value="Mañana">🌅 Mañana</option>
                        <option value="Siesta">☀️ Siesta</option>
                        <option value="Tarde">🌇 Tarde</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-6)', alignItems: 'start' }}>
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Planilla de Asignaciones ({asignaciones.length})</h2>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Chofer</th>
                                    <th>Vehículo</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center' }}>Cargando asignaciones...</td></tr>
                                ) : asignaciones.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center' }}>No hay asignaciones para este turno.</td></tr>
                                ) : (
                                    asignaciones.map(asig => (
                                        <tr key={asig.id}>
                                            <td style={{ fontWeight: 600 }}>{asig.empleado.nombre} {asig.empleado.apellido}</td>
                                            <td>
                                                <div style={{ fontWeight: 'bold', fontSize: 'var(--text-sm)' }}>
                                                    {asig.vehiculo.alias ? `${asig.vehiculo.alias} ` : ''}
                                                    <span style={{ fontSize: asig.vehiculo.alias ? '0.85em' : '1em', color: asig.vehiculo.alias ? 'var(--color-gray-500)' : 'inherit' }}>
                                                        {asig.vehiculo.alias ? `(${asig.vehiculo.patente})` : asig.vehiculo.patente}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>{asig.vehiculo.marca} {asig.vehiculo.modelo}</div>
                                            </td>
                                            <td>
                                                <span className="badge badge-success">ASIGNADO</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button onClick={() => handleDelete(asig.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}>
                                                    Quitar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card shadow-sm" style={{ backgroundColor: 'var(--color-gray-50)' }}>
                    <div className="card-header">
                        <h2 className="card-title">Nueva Asignación</h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Chofer</label>
                            <select className="form-select" value={selectedChofer} onChange={e => setSelectedChofer(e.target.value)}>
                                <option value="">Seleccionar chofer...</option>
                                {choferes.map(c => (
                                    <option key={c.id} value={c.id} disabled={asignaciones.some(a => a.empleadoId === c.id)}>
                                        {c.nombre} {c.apellido} {asignaciones.some(a => a.empleadoId === c.id) ? '(Ya asignado)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Vehículo Disponible</label>
                            <select className="form-select" value={selectedVehiculo} onChange={e => setSelectedVehiculo(e.target.value)}>
                                <option value="">Seleccionar vehículo...</option>
                                {availableVehiculos.map(v => (
                                    <option key={v.id} value={v.id}>{v.alias ? `${v.alias} (${v.patente})` : `${v.patente} - ${v.marca}`}</option>
                                ))}
                            </select>
                            {availableVehiculos.length === 0 && (
                                <p style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '4px' }}>
                                    ⚠️ No hay más vehículos disponibles para este turno.
                                </p>
                            )}
                        </div>

                        <button onClick={handleAssign} className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }} disabled={saving || !selectedChofer || !selectedVehiculo}>
                            {saving ? 'Guardando...' : '➡️ Asignar Vehículo'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                <div className="card-header">
                    <h2 className="card-title">Historial y Consultas Rápidas</h2>
                </div>
                <div style={{ padding: 'var(--space-4)' }}>
                   <p style={{ color: 'var(--color-gray-600)', fontSize: 'var(--text-sm)' }}>
                       Cambiá la fecha en el selector de arriba para consultar el registro histórico de cualquier día. 
                       El sistema mantiene un log permanente de quién utilizó cada móvil.
                   </p>
                </div>
            </div>
        </div>
    )
}
