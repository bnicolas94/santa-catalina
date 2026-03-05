'use client'

import { useState, useEffect, useRef } from 'react'
import { Empleado } from '@prisma/client'
import { EmpleadoDialog } from '@/components/empleados/EmpleadoDialog'
import Link from 'next/link'

export default function EmpleadosPage() {
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null)
    const [importLoading, setImportLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchEmpleados = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/empleados')
            const data = await res.json()
            setEmpleados(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEmpleados()
    }, [])

    const handleSave = async (formData: any) => {
        const url = selectedEmpleado ? `/api/empleados/${selectedEmpleado.id}` : '/api/empleados'
        const method = selectedEmpleado ? 'PUT' : 'POST'

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })

        if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Error al guardar')
        }

        await fetchEmpleados()
        setDialogOpen(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas dar de baja o eliminar este empleado?')) return
        try {
            await fetch(`/api/empleados/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: false })
            })
            await fetchEmpleados()
        } catch (error) {
            console.error(error)
            alert('Error al desactivar empleado')
        }
    }

    const handleOpenDialog = (emp?: Empleado) => {
        setSelectedEmpleado(emp || null)
        setDialogOpen(true)
    }

    const handleImportarClic = () => {
        fileInputRef.current?.click()
    }

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImportLoading(true)
        try {
            // Simulamos la lectura de un Excel
            const mockRegistrosExtraidos = [
                { codigoBiometrico: "1", fechaHora: new Date(new Date().setHours(8, 0)).toISOString(), tipo: "entrada" },
                { codigoBiometrico: "1", fechaHora: new Date(new Date().setHours(18, 0)).toISOString(), tipo: "salida" }
            ]

            const res = await fetch('/api/fichadas/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registros: mockRegistrosExtraidos })
            })

            const dat = await res.json()
            if (dat.success) {
                alert(dat.mensaje)
                // Si la tabla principal mostrara horas, aquí se llamaría a fetchEmpleados()
            } else {
                alert('Error en importación: ' + dat.error)
            }
        } catch (error) {
            console.error(error)
            alert('Falló el procesamiento del archivo')
        } finally {
            setImportLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>⚙️ Equipo y RRHH</h1>
                    <p style={{ color: 'var(--color-gray-500)', marginTop: 'var(--space-1)' }}>
                        Gestión de nómina, fichadas y liquidaciones
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelected}
                        style={{ display: 'none' }}
                        accept=".csv, .xls, .xlsx"
                    />
                    <button
                        onClick={handleImportarClic}
                        disabled={importLoading}
                        className="btn btn-outline"
                    >
                        {importLoading ? (
                            <><span className="spinner" style={{ width: '16px', height: '16px', borderTopColor: 'var(--color-primary)', opacity: 0.8 }}></span> Importando...</>
                        ) : (
                            <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Subir Excel del Reloj</>
                        )}
                    </button>
                    <button
                        onClick={() => handleOpenDialog()}
                        className="btn btn-primary"
                    >
                        + Nuevo Empleado
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="empty-state">
                    <div className="spinner"></div>
                    <p>Cargando empleados...</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Rol / Puesto</th>
                                <th>Contacto</th>
                                <th>Ciclo / Base</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {empleados.map((emp: any) => (
                                <tr key={emp.id} style={{ opacity: emp.activo ? 1 : 0.6 }}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <div style={{
                                                width: 40, height: 40, borderRadius: '50%',
                                                backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                            }}>
                                                {emp.nombre.charAt(0)}{(emp as any).apellido?.charAt(0) || ''}
                                            </div>
                                            <div>
                                                <Link href={`/empleados/${emp.id}`} style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                                    {emp.nombre} {(emp as any).apellido || ''}
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                </Link>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '2px' }}>
                                                    DNI: {(emp as any).dni || 'S/D'} • Reloj: {(emp as any).codigoBiometrico || 'Sin vincular'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge badge-info">
                                            {emp.rol}
                                        </span>
                                    </td>
                                    <td>
                                        <div>{emp.email}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{emp.telefono || '—'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{(emp as any).cicloPago || 'SEMANAL'}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                            ${(emp as any).sueldoBaseMensual?.toLocaleString() || '0'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${emp.activo ? 'badge-success' : 'badge-neutral'}`}>
                                            {emp.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => handleOpenDialog(emp)}
                                                title="Editar"
                                            >
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            {emp.activo && (
                                                <button
                                                    className="btn btn-ghost btn-icon"
                                                    style={{ color: 'var(--color-danger)' }}
                                                    onClick={() => handleDelete(emp.id)}
                                                    title="Dar de baja"
                                                >
                                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {empleados.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-500)' }}>
                                        No hay empleados registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {dialogOpen && (
                <EmpleadoDialog
                    empleado={selectedEmpleado}
                    onClose={() => setDialogOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    )
}
