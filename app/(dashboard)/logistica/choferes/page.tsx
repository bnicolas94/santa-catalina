"use client"

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import LicenciaModal from '@/components/logistica/LicenciaModal'
import Link from 'next/link'

interface Chofer {
    id: string
    nombre: string
    apellido: string
    documentos: any[]
}

export default function ChoferesPage() {
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedChofer, setSelectedChofer] = useState<Chofer | null>(null)

    useEffect(() => {
        fetchChoferes()
    }, [])

    async function fetchChoferes() {
        try {
            const res = await fetch('/api/logistica/choferes')
            const data = await res.json()
            setChoferes(data)
        } catch (error) {
            console.error('Error fetching choferes:', error)
            toast.error('Error al cargar choferes')
        } finally {
            setLoading(false)
        }
    }

    const getStatusInfo = (fechaStr: string | null) => {
        if (!fechaStr) return { label: 'PENDIENTE', color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)' }
        
        const fecha = new Date(fechaStr)
        const hoy = new Date()
        const diffTime = fecha.getTime() - hoy.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays < 0) return { label: 'VENCIDO', color: 'var(--color-danger)', bg: 'var(--color-danger-light)' }
        if (diffDays <= 30) return { label: `VENCE EN ${diffDays} DÍAS`, color: 'var(--color-warning-dark)', bg: 'var(--color-warning-light)' }
        
        return { label: 'AL DÍA', color: 'var(--color-success)', bg: 'var(--color-success-light)' }
    }

    return (
        <div className="page-content">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <h1 className="page-title">Administración de Choferes</h1>
                </div>
                <div className="page-actions">
                    <Link href="/logistica" className="btn btn-ghost">← Volver</Link>
                </div>
            </div>

            <div className="card shadow-sm">
                <div className="card-header">
                    <h2 className="card-title">Listado de Personal de Logística</h2>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nombre y Apellido</th>
                                <th>Vencimiento Licencia</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-10)' }}>Cargando choferes...</td></tr>
                            ) : choferes.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-10)' }}>No se encontraron empleados con rol Logística.</td></tr>
                            ) : (
                                choferes.map(c => {
                                    const doc = c.documentos?.[0]
                                    const status = getStatusInfo(doc?.fechaVencimiento)
                                    return (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 'bold' }}>{c.nombre} {c.apellido}</td>
                                            <td>
                                                {doc?.fechaVencimiento 
                                                    ? new Date(doc.fechaVencimiento).toLocaleDateString('es-AR') 
                                                    : 'Sin registrar'}
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    padding: '4px 10px', 
                                                    borderRadius: '20px', 
                                                    fontSize: '11px', 
                                                    fontWeight: 'bold',
                                                    color: status.color,
                                                    backgroundColor: status.bg
                                                }}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                                                    {doc?.archivoUrl && (
                                                        <a 
                                                            href={doc.archivoUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="btn btn-ghost btn-sm"
                                                            title="Ver documento actual"
                                                        >
                                                            👁️ Ver
                                                        </a>
                                                    )}
                                                    <button 
                                                        onClick={() => setSelectedChofer(c)}
                                                        className="btn btn-outline btn-sm"
                                                    >
                                                        🪪 {doc ? 'Actualizar' : 'Cargar'} Licencia
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedChofer && (
                <LicenciaModal 
                    chofer={selectedChofer}
                    onClose={() => setSelectedChofer(null)}
                    onSuccess={fetchChoferes}
                />
            )}
        </div>
    )
}
