'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Empleado } from '@prisma/client'
import { EmpleadoDialog } from '@/components/empleados/EmpleadoDialog'
import RolesConfigModal from '@/components/empleados/RolesConfigModal'
import { MassLiquidationModal } from '@/components/empleados/MassLiquidationModal'
import { ExpressLiquidationModal } from '@/components/empleados/ExpressLiquidationModal'
import { ConfigLicenciasModal } from '@/components/empleados/ConfigLicenciasModal'
import { ReportePagosModal } from '@/components/empleados/ReportePagosModal'
import FeriadosConfigModal from '@/components/empleados/FeriadosConfigModal'
import { WeeklyPayrollModal } from '@/components/empleados/WeeklyPayrollModal'
import OrganigramaModal from '@/components/empleados/OrganigramaModal'
import TurnosConfigModal from '@/components/empleados/TurnosConfigModal'
import ConceptosSalarialesModal from '@/components/empleados/ConceptosSalarialesModal'
import { VacacionesSACModal } from '@/components/empleados/VacacionesSACModal'
import { ReporteVacacionesModal } from '@/components/empleados/ReporteVacacionesModal'
import { InasistenciasModal } from '@/components/empleados/InasistenciasModal'
import Link from 'next/link'

export default function EmpleadosPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <EmpleadosContent />
        </Suspense>
    )
}

function EmpleadosContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const openParam = searchParams.get('open')
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null)
    const [showRolesModal, setShowRolesModal] = useState(false)
    const [showLicenciasModal, setShowLicenciasModal] = useState(false)
    const [showReportePagos, setShowReportePagos] = useState(false)
    const [importLoading, setImportLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [massLiquidationOpen, setMassLiquidationOpen] = useState(false)
    const [weeklyPayrollOpen, setWeeklyPayrollOpen] = useState(false)
    const [expressLiquidationOpen, setExpressLiquidationOpen] = useState(false)
    const [showFeriadosModal, setShowFeriadosModal] = useState(false)
    const [pendingRegistros, setPendingRegistros] = useState<any[]>([])
    const [ubicaciones, setUbicaciones] = useState<any[]>([])
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [showOrganigramaModal, setShowOrganigramaModal] = useState(false)
    const [showTurnosModal, setShowTurnosModal] = useState(false)
    const [showConceptosModal, setShowConceptosModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterActivo, setFilterActivo] = useState<boolean | 'todos'>(true)
    const [vacacionesSacOpen, setVacacionesSacOpen] = useState(false)
    const [showReporteVacaciones, setShowReporteVacaciones] = useState(false)
    const [showInasistenciasModal, setShowInasistenciasModal] = useState(false)

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

    const fetchUbicaciones = async () => {
        try {
            const res = await fetch('/api/ubicaciones')
            const data = await res.json()
            setUbicaciones(data)
        } catch (error) {
            console.error('Error fetching ubicaciones:', error)
        }
    }

    useEffect(() => {
        fetchEmpleados()
        fetchUbicaciones()
    }, [])

    useEffect(() => {
        if (!openParam) return

        // Sincronizar parámetros de URL con estados de modales
        if (openParam === 'weekly') setWeeklyPayrollOpen(true)
        if (openParam === 'vacaciones') setVacacionesSacOpen(true)
        if (openParam === 'mass') setMassLiquidationOpen(true)
        if (openParam === 'recibos') setShowReportePagos(true)
        if (openParam === 'historial') setShowReporteVacaciones(true)
        if (openParam === 'roles') setShowRolesModal(true)
        if (openParam === 'feriados') setShowFeriadosModal(true)
        if (openParam === 'turnos') setShowTurnosModal(true)
        if (openParam === 'conceptos') setShowConceptosModal(true)
        if (openParam === 'licencias') setShowLicenciasModal(true)
        if (openParam === 'inasistencias') setShowInasistenciasModal(true)
        if (openParam === 'new') handleOpenDialog()
        if (openParam === 'import') handleImportarClic()
    }, [openParam])

    const closeModal = () => {
        // Limpiar parámetros de URL al cerrar cualquier modal
        const params = new URLSearchParams(searchParams.toString())
        params.delete('open')
        router.push(`/empleados?${params.toString()}`)
        
        // También cerramos los estados locales
        setWeeklyPayrollOpen(false)
        setVacacionesSacOpen(false)
        setMassLiquidationOpen(false)
        setShowReportePagos(false)
        setShowReporteVacaciones(false)
        setShowRolesModal(false)
        setShowFeriadosModal(false)
        setShowTurnosModal(false)
        setShowConceptosModal(false)
        setShowLicenciasModal(false)
        setDialogOpen(false)
        setExpressLiquidationOpen(false)
        setShowInasistenciasModal(false)
    }

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

    const handleQuickUpdateLocation = async (empleadoId: string, ubicacionId: string) => {
        setUpdatingId(empleadoId)
        try {
            const res = await fetch(`/api/empleados/${empleadoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ubicacionId: ubicacionId === "" ? null : ubicacionId })
            })

            if (!res.ok) throw new Error('Error al actualizar ubicación')
            
            await fetchEmpleados()
        } catch (error: any) {
            alert(error.message)
        } finally {
            setUpdatingId(null)
        }
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
            let registrosExtraidos: any[] = []

            if (file.name.endsWith('.txt')) {
                const text = await file.text()
                const lines = text.split('\n')
                const marcasPorDia: Record<string, string[]> = {}

                lines.forEach(line => {
                    // Soporta Tabs (\t) o 2+ espacios como separadores de columna
                    const columns = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(c => c !== '')
                    if (columns.length >= 4) {
                        // EnNo es la 3era columna (index 2)
                        const rawCode = columns[2]
                        if (rawCode && /^\d+$/.test(rawCode)) {
                            const cleanCode = parseInt(rawCode, 10).toString()
                            // Buscamos algo que parezca YYYY/MM/DD o YYYY-MM-DD
                            const dateMatch = line.match(/(\d{4}[\/-]\d{2}[\/-]\d{2})\s+(\d{2}:\d{2}:\d{2})/)
                            
                            if (dateMatch) {
                                const [_, fechaStr, horaStr] = dateMatch
                                const normalizedDate = fechaStr.replace(/\//g, '-')
                                const key = `${cleanCode}_${normalizedDate}`
                                if (!marcasPorDia[key]) marcasPorDia[key] = []
                                marcasPorDia[key].push(`${normalizedDate} ${horaStr}`)
                            }
                        }
                    }
                })

                Object.entries(marcasPorDia).forEach(([key, marcas]) => {
                    const [codigo] = key.split('_')
                    marcas.sort()
                    marcas.forEach((m, idx) => {
                        const tipo = idx % 2 === 0 ? 'entrada' : 'salida'
                        // Asegurar formato ISO para que el backend no tenga dudas
                        const [f, h] = m.split(' ')
                        const isoStr = new Date(`${f}T${h}`).toISOString()
                        
                        registrosExtraidos.push({
                            idTemp: Math.random().toString(36).substr(2, 9),
                            codigoBiometrico: codigo,
                            fechaHora: isoStr,
                            tipo,
                            originalStr: m
                        })
                    })
                })
            } else {
                // Placeholder para Excel
                registrosExtraidos = [
                    { idTemp: '1', codigoBiometrico: "1", fechaHora: new Date(new Date().setHours(8, 0)).toISOString(), tipo: "entrada" },
                    { idTemp: '2', codigoBiometrico: "1", fechaHora: new Date(new Date().setHours(18, 0)).toISOString(), tipo: "salida" }
                ]
            }

            if (registrosExtraidos.length === 0) {
                alert('No se encontraron registros válidos en el archivo.')
                return
            }

            setPendingRegistros(registrosExtraidos)
            setReviewModalOpen(true)

        } catch (error) {
            console.error(error)
            alert('Falló el procesamiento del archivo.')
        } finally {
            setImportLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleConfirmImport = async (finalRegistros: any[]) => {
        try {
            setImportLoading(true)
            const res = await fetch('/api/fichadas/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registros: finalRegistros })
            })

            const dat = await res.json()
            if (dat.success) {
                alert(`¡Éxito! ${dat.mensaje}`)
                setReviewModalOpen(false)
            } else {
                alert('Error en importación: ' + dat.error)
            }
        } catch (error) {
            alert('Error al conectar con el servidor.')
        } finally {
            setImportLoading(false)
        }
    }

    const filteredEmpleados = empleados.filter(e => {
        const matchesSearch = e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (e as any).apellido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (e as any).dni?.includes(searchTerm)
        const matchesActivo = filterActivo === 'todos' ? true : e.activo === filterActivo
        return matchesSearch && matchesActivo
    })

    const stats = {
        total: empleados.length,
        presentes: empleados.filter(e => (e as any).asistenciaHoy?.tieneEntrada).length,
        tardanzas: empleados.filter(e => (e as any).asistenciaHoy?.esTarde).length,
        ausentes: empleados.filter(e => (e as any).asistenciaHoy?.esAusente).length
    }

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
                <div>
                    <h1>⚙️ Equipo y RRHH</h1>
                    <p style={{ color: 'var(--color-gray-500)', marginTop: 'var(--space-1)' }}>
                        Gestión de nómina, fichadas y liquidaciones
                    </p>
                </div>
                <div style={{ display: 'none' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelected}
                        style={{ display: 'none' }}
                        accept=".txt, .csv, .xls, .xlsx"
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)', textTransform: 'uppercase' }}>Total Equipo</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{stats.total}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)', textTransform: 'uppercase' }}>Presentes Hoy</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-success)' }}>{stats.presentes}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-danger)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)', textTransform: 'uppercase' }}>Tardanzas</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: stats.tardanzas > 0 ? 'var(--color-danger)' : 'inherit' }}>{stats.tardanzas}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-gray-300)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)', textTransform: 'uppercase' }}>Ausentes / Restan</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-gray-500)' }}>{stats.ausentes}</div>
                </div>
            </div>

            {/* Toolbar Secundaria */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 'var(--space-4)', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }}>🔍</span>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Buscar por nombre, apellido o DNI..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '36px', width: '300px', height: '36px' }}
                        />
                    </div>
                    <select 
                        className="form-select" 
                        value={String(filterActivo)} 
                        onChange={e => setFilterActivo(e.target.value === 'todos' ? 'todos' : e.target.value === 'true')}
                        style={{ height: '36px', fontSize: 'var(--text-sm)' }}
                    >
                        <option value="true">Activos</option>
                        <option value="false">Inactivos</option>
                        <option value="todos">Todos</option>
                    </select>
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
                                <th>Sueldo / Ciclo</th>
                                <th>Ubicación</th>
                                <th>Hoy</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmpleados.map((emp: any) => (
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
                                        {(emp as any).area && (
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '2px' }}>
                                                <span style={{
                                                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                                    backgroundColor: (emp as any).area?.color || 'var(--color-gray-300)',
                                                    marginRight: 4
                                                }} />
                                                {(emp as any).area?.nombre}
                                                {(emp as any).puesto && <span> • {(emp as any).puesto?.nombre}</span>}
                                            </div>
                                        )}
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
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <select
                                                value={emp.ubicacionId || ''}
                                                onChange={(e) => handleQuickUpdateLocation(emp.id, e.target.value)}
                                                disabled={updatingId === emp.id}
                                                style={{
                                                    appearance: 'none',
                                                    padding: '4px 28px 4px 8px',
                                                    fontSize: 'var(--text-xs)',
                                                    fontWeight: 500,
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-gray-200)',
                                                    backgroundColor: emp.ubicacionId ? 'var(--color-gray-50)' : 'transparent',
                                                    color: emp.ubicacionId ? 'var(--color-gray-800)' : 'var(--color-gray-400)',
                                                    cursor: updatingId === emp.id ? 'wait' : 'pointer',
                                                    width: 'auto',
                                                    minWidth: '120px'
                                                }}
                                            >
                                                <option value="">— Sin asignar —</option>
                                                {ubicaciones.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                            <div style={{
                                                position: 'absolute',
                                                right: '8px',
                                                pointerEvents: 'none',
                                                color: 'var(--color-gray-400)',
                                                display: 'flex'
                                            }}>
                                                {updatingId === emp.id ? (
                                                    <div className="spinner-xs"></div>
                                                ) : (
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <div 
                                                title={ (emp as any).asistenciaHoy?.tieneEntrada ? 'Entrada registrada' : 'Sin entrada' }
                                                style={{ 
                                                    width: 10, height: 10, borderRadius: '50%', 
                                                    backgroundColor: (emp as any).asistenciaHoy?.esTarde ? 'var(--color-danger)' : ((emp as any).asistenciaHoy?.tieneEntrada ? 'var(--color-success)' : 'var(--color-gray-200)') 
                                                }} 
                                            />
                                            <div 
                                                title={ (emp as any).asistenciaHoy?.tieneSalida ? 'Salida registrada' : 'Sin salida' }
                                                style={{ 
                                                    width: 10, height: 10, borderRadius: '50%', 
                                                    backgroundColor: (emp as any).asistenciaHoy?.tieneSalida ? 'var(--color-success)' : 'var(--color-gray-200)' 
                                                }} 
                                            />
                                            { (emp as any).asistenciaHoy?.esTarde && (
                                                <span style={{ fontSize: '9px', color: 'var(--color-danger)', fontWeight: 800 }}>TARDE</span>
                                            )}
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
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => { setSelectedEmpleado(emp); setExpressLiquidationOpen(true); }}
                                                title="Liquidación Express"
                                                style={{ color: 'var(--color-success)' }}
                                            >
                                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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

            {reviewModalOpen && (
                <ReviewImportModal
                    registros={pendingRegistros}
                    empleados={empleados}
                    onClose={() => setReviewModalOpen(false)}
                    onConfirm={handleConfirmImport}
                />
            )}

            {massLiquidationOpen && (
                <MassLiquidationModal
                    empleados={empleados}
                    onClose={closeModal}
                    onSuccess={() => { fetchEmpleados(); closeModal(); }}
                />
            )}

            {expressLiquidationOpen && (
                <ExpressLiquidationModal
                    empleado={selectedEmpleado}
                    onClose={() => setExpressLiquidationOpen(false)}
                    onSuccess={() => fetchEmpleados()}
                />
            )}

            {dialogOpen && (
                <EmpleadoDialog
                    empleado={selectedEmpleado}
                    onClose={closeModal}
                    onSave={handleSave}
                />
            )}

            {showRolesModal && (
                <RolesConfigModal
                    onClose={closeModal}
                    onRolesChanged={() => {
                        // Refresh logic if needed
                    }}
                />
            )}
            {showLicenciasModal && (
                <ConfigLicenciasModal onClose={closeModal} />
            )}
            {showReporteVacaciones && (
                <ReporteVacacionesModal onClose={closeModal} />
            )}
            
            {showReportePagos && (
                <ReportePagosModal onClose={closeModal} />
            )}
            {showFeriadosModal && (
                <FeriadosConfigModal onClose={closeModal} />
            )}
            {weeklyPayrollOpen && (
                <WeeklyPayrollModal 
                    empleados={empleados} 
                    onClose={closeModal} 
                    onSuccess={() => { fetchEmpleados(); closeModal(); }} 
                />
            )}
            {showOrganigramaModal && (
                <OrganigramaModal
                    onClose={closeModal}
                    empleados={empleados.map(e => ({ id: e.id, nombre: e.nombre, apellido: (e as any).apellido }))}
                    onChanged={() => fetchEmpleados()}
                />
            )}
            {showTurnosModal && (
                <TurnosConfigModal onClose={closeModal} />
            )}
            {showConceptosModal && (
                <ConceptosSalarialesModal onClose={closeModal} />
            )}
            {vacacionesSacOpen && (
                <VacacionesSACModal 
                    empleados={empleados.filter(e => e.activo)} 
                    onClose={closeModal} 
                />
            )}
            {showInasistenciasModal && (
                <InasistenciasModal
                    isOpen={showInasistenciasModal}
                    onClose={closeModal}
                    empleados={empleados}
                />
            )}
        </div>
    )
}

function ReviewImportModal({ registros, empleados, onClose, onConfirm }: { registros: any[], empleados: any[], onClose: () => void, onConfirm: (data: any[]) => void }) {
    const [localRegistros, setLocalRegistros] = useState(registros)

    const handleUpdateFichada = (idTemp: string, newTime: string) => {
        setLocalRegistros(prev => prev.map(r => {
            if (r.idTemp === idTemp) {
                // Mantenemos la fecha original pero cambiamos la hora
                const d = new Date(r.fechaHora)
                const [h, m] = newTime.split(':')
                d.setHours(parseInt(h), parseInt(m))
                return { ...r, fechaHora: d.toISOString() }
            }
            return r
        }))
    }

    const handleAddMissing = (baseRegistro: any, type: 'entrada' | 'salida') => {
        const newReg = {
            idTemp: Math.random().toString(36).substr(2, 9),
            codigoBiometrico: baseRegistro.codigoBiometrico,
            fechaHora: baseRegistro.fechaHora, // Por defecto misma hora para que el usuario la ajuste
            tipo: type,
            originalStr: 'Manual'
        }
        setLocalRegistros(prev => [...prev, newReg].sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()))
    }

    const handleDelete = (idTemp: string) => {
        setLocalRegistros(prev => prev.filter(r => r.idTemp !== idTemp))
    }

    // Agrupar por empleado y día para visualizar inconsistencias
    const agrupados: Record<string, any[]> = {}
    localRegistros.forEach(r => {
        const emp = empleados.find(e => e.codigoBiometrico === r.codigoBiometrico)
        const nombre = emp ? `${emp.nombre} ${emp.apellido || ''}` : `Código ${r.codigoBiometrico} (No vinculado)`
        const fecha = new Date(r.fechaHora).toLocaleDateString()
        const key = `${nombre} - ${fecha}`
        if (!agrupados[key]) agrupados[key] = []
        agrupados[key].push(r)
    })

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflow: 'hidden' }}>
                <div className="modal-header">
                    <div>
                        <h2>🛡️ Asistente de Validación</h2>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>Revisa y corrige las fichadas antes de guardarlas.</p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
                </div>
                <div className="modal-body" style={{ overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {Object.entries(agrupados).map(([key, marcas]) => {
                            const isOdd = marcas.length % 2 !== 0
                            const hasConflict = isOdd || marcas.some((m, idx) => {
                                // Verificar secuencia entrada -> salida
                                if (idx % 2 === 0 && m.tipo !== 'entrada') return true
                                if (idx % 2 !== 0 && m.tipo !== 'salida') return true
                                return false
                            })

                            return (
                                <div key={key} className="card" style={{ borderLeft: hasConflict ? '4px solid var(--color-danger)' : '4px solid var(--color-success)' }}>
                                    <div className="card-body" style={{ padding: 'var(--space-3)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                            <span style={{ fontWeight: 700 }}>{key}</span>
                                            {isOdd && <span className="badge badge-danger">Falta una marca</span>}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                            {marcas.sort((a: any, b: any) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()).map((m) => (
                                                <div key={m.idTemp} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    backgroundColor: 'var(--color-gray-50)',
                                                    padding: '4px 8px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-gray-200)'
                                                }}>
                                                    <span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                                                        {m.tipo.toUpperCase()}
                                                    </span>
                                                    <input
                                                        type="time"
                                                        value={new Date(m.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        onChange={(e) => handleUpdateFichada(m.idTemp, e.target.value)}
                                                        style={{ border: 'none', background: 'transparent', fontWeight: 600, width: '70px' }}
                                                    />
                                                    <button onClick={() => handleDelete(m.idTemp)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>✕</button>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleAddMissing(marcas[0], 'entrada')}>+ Ent.</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleAddMissing(marcas[0], 'salida')}>+ Sal.</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={() => onConfirm(localRegistros)}>Confirmar e Importar ({localRegistros.length})</button>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(2px);
                }
                .modal {
                    background: white;
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                }
            `}</style>
        </div>
    )
}
