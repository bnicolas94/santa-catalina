"use client"

import { useState, useEffect, useMemo } from 'react'
import DocumentosTab from './DocumentosTab'
import EvaluacionesTab from './EvaluacionesTab'
import LiquidacionFinalModal from './LiquidacionFinalModal'
import styles from './EmpleadoDialog.module.css'

interface EmployeeRole {
    id: string
    nombre: string
    descripcion?: string | null
    color?: string | null
    permisoDashboard: boolean
    permisoStock: boolean
    permisoCaja: boolean
    permisoPersonal: boolean
    permisoProduccion: boolean
    permisoCostos: boolean
    permisoAtencion: boolean
    permisoAtencionAdmin: boolean
    jornal: number
    valorHoraExtra: number
    cicloPago: string
}

interface EmployeeDialogEmployee {
    id: string
    nombre?: string | null
    apellido?: string | null
    dni?: string | null
    email?: string | null
    telefono?: string | null
    rol?: string | null
    fechaIngreso?: string | Date | null
    sueldoBaseMensual?: number | null
    cicloPago?: string | null
    modalidadPago?: string | null
    porcentajeHoraExtra?: number | null
    porcentajeFeriado?: number | null
    horasTrabajoDiarias?: number | null
    diasTrabajoSemana?: string | null
    horarioEntrada?: string | null
    horarioSalida?: string | null
    codigoBiometrico?: string | null
    ubicacionId?: string | null
    rolId?: string | null
    jornal?: number | null
    valorHoraExtra?: number | null
    areaId?: string | null
    puestoId?: string | null
    turnoId?: string | null
}

interface EmployeeFormData {
    nombre: string
    apellido: string
    dni: string
    email: string
    telefono: string
    rol: string
    password: string
    fechaIngreso: string
    sueldoBaseMensual: string
    cicloPago: string
    modalidadPago: string
    porcentajeHoraExtra: string
    porcentajeFeriado: string
    horasTrabajoDiarias: string
    diasTrabajoSemana: string
    horarioEntrada: string
    horarioSalida: string
    codigoBiometrico: string
    ubicacionId: string
    rolId: string
    jornal: string
    valorHoraExtra: string
    areaId: string
    puestoId: string
    turnoId: string
}

interface LocationOption { id: string; nombre: string; tipo: string }
interface AreaOption { id: string; nombre: string; activo: boolean }
interface PositionOption { id: string; nombre: string }
interface ShiftOption { id: string; nombre: string; horaInicio: string; horaFin: string; activo: boolean }

const ROLE_PERMISSIONS: Array<{ key: keyof EmployeeRole; label: string }> = [
    { key: 'permisoDashboard', label: 'Dashboard' },
    { key: 'permisoStock', label: 'Stock y compras' },
    { key: 'permisoCaja', label: 'Caja' },
    { key: 'permisoPersonal', label: 'Personal' },
    { key: 'permisoProduccion', label: 'Producción' },
    { key: 'permisoCostos', label: 'Costos' },
    { key: 'permisoAtencion', label: 'Atención' },
    { key: 'permisoAtencionAdmin', label: 'Supervisión de atención' },
]

interface EmpleadoDialogProps {
    empleado?: EmployeeDialogEmployee | null
    onSave: (data: EmployeeFormData) => Promise<void>
    onClose: () => void
}

export function EmpleadoDialog({ empleado, onSave, onClose }: EmpleadoDialogProps) {
    const isEdit = !!empleado
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState('personal')
    const [showFinalModal, setShowFinalModal] = useState(false)
    const [roles, setRoles] = useState<EmployeeRole[]>([])
    const [ubicaciones, setUbicaciones] = useState<LocationOption[]>([])
    const [areas, setAreas] = useState<AreaOption[]>([])
    const [puestos, setPuestos] = useState<PositionOption[]>([])
    const [turnos, setTurnos] = useState<ShiftOption[]>([])

    // Estado local del form
    const [formData, setFormData] = useState<EmployeeFormData>({
        nombre: empleado?.nombre || '',
        apellido: empleado?.apellido || '',
        dni: empleado?.dni || '',
        email: empleado?.email || '',
        telefono: empleado?.telefono || '',
        rol: empleado?.rol || 'OPERARIO',
        password: '', // Solo al crear o cambiar
        fechaIngreso: empleado?.fechaIngreso ? new Date(empleado.fechaIngreso).toISOString().split('T')[0] : '',
        sueldoBaseMensual: empleado?.sueldoBaseMensual?.toString() || '0',
        cicloPago: empleado?.cicloPago || 'SEMANAL',
        modalidadPago: empleado?.modalidadPago || 'SEMANAL_EFECTIVO',
        porcentajeHoraExtra: empleado?.porcentajeHoraExtra?.toString() || '50',
        porcentajeFeriado: empleado?.porcentajeFeriado?.toString() || '100',
        horasTrabajoDiarias: empleado?.horasTrabajoDiarias?.toString() || '8',
        diasTrabajoSemana: empleado?.diasTrabajoSemana || 'Lunes a Viernes',
        horarioEntrada: empleado?.horarioEntrada || '',
        horarioSalida: empleado?.horarioSalida || '',
        codigoBiometrico: empleado?.codigoBiometrico || '',
        ubicacionId: empleado?.ubicacionId || '',
        rolId: empleado?.rolId || '',
        jornal: empleado?.jornal?.toString() || '0',
        valorHoraExtra: empleado?.valorHoraExtra?.toString() || '0',
        areaId: empleado?.areaId || '',
        puestoId: empleado?.puestoId || '',
        turnoId: empleado?.turnoId || '',
    })

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await fetch('/api/empleados/roles')
                const data = await res.json()
                setRoles(data)
                
                // Vinculación automática si tiene rol (string) pero no rolId
                setFormData(current => {
                    if (!Array.isArray(data) || current.rolId || !current.rol) return current
                    const match = data.find((role: EmployeeRole) => role.nombre === current.rol)
                    return match ? { ...current, rolId: match.id } : current
                })
            } catch (error) {
                console.error('Error fetching roles:', error)
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
        fetchRoles()
        fetchUbicaciones()
        fetchAreas()
        fetchTurnos()
    }, [])

    // Cargar puestos cuando cambia el área seleccionada
    useEffect(() => {
        if (formData.areaId) {
            fetchPuestos(formData.areaId)
        } else {
            setPuestos([])
        }
    }, [formData.areaId])

    // Estado local para el input de remuneración para que no "salte" con los decimales mientras tipea
    const initialMonto = (
        formData.cicloPago === 'DIARIO'
            ? (parseFloat(formData.jornal) || 0)
            : formData.cicloPago === 'SEMANAL'
                ? (parseFloat(formData.sueldoBaseMensual) || 0) / 4.3
                : formData.cicloPago === 'QUINCENAL'
                    ? (parseFloat(formData.sueldoBaseMensual) || 0) / 2
                    : (parseFloat(formData.sueldoBaseMensual) || 0)
    ).toString()
    const [montoInput, setMontoInput] = useState(initialMonto)
    const [salarySource, setSalarySource] = useState<'ROLE' | 'CUSTOM'>(() => (
        (Number(empleado?.sueldoBaseMensual || 0) > 0 || Number(empleado?.jornal || 0) > 0) ? 'CUSTOM' : 'ROLE'
    ))
    const selectedRole = useMemo(() => roles.find(role => role.id === formData.rolId) || null, [roles, formData.rolId])
    const permisosDelRol = selectedRole ? ROLE_PERMISSIONS.filter(permission => selectedRole[permission.key] === true) : []
    const usaBaseDelRol = Boolean(selectedRole) && salarySource === 'ROLE'

    const personalizarBaseSalarial = () => {
        if (!selectedRole) return
        setSalarySource('CUSTOM')
        const amount = Number(selectedRole.jornal || 0)
        const cycle = selectedRole.cicloPago || 'SEMANAL'
        const monthly = cycle === 'DIARIO' ? amount * 30 : cycle === 'SEMANAL' ? amount * 4.3 : amount
        setMontoInput(amount ? String(amount) : '')
        setFormData(current => ({
            ...current,
            cicloPago: cycle,
            jornal: cycle === 'DIARIO' ? String(amount) : '0',
            sueldoBaseMensual: String(monthly),
        }))
    }

    const usarBaseDelRol = () => {
        if (!selectedRole) return
        setSalarySource('ROLE')
        setMontoInput('0')
        setFormData(current => ({
            ...current,
            cicloPago: selectedRole.cicloPago || 'SEMANAL',
            jornal: '0',
            sueldoBaseMensual: '0',
            valorHoraExtra: '0',
        }))
    }

    const calculateHours = (entrada: string, salida: string) => {
        if (!entrada || !salida) return null
        const [h1, m1] = entrada.split(':').map(Number)
        const [h2, m2] = salida.split(':').map(Number)

        let diffMs = (h2 * 60 + m2) - (h1 * 60 + m1)
        if (diffMs < 0) diffMs += 24 * 60 // Caso nocturno si aplica

        return (diffMs / 60).toFixed(1)
    }

    const fetchAreas = async () => {
        try {
            const res = await fetch('/api/areas')
            const data = await res.json()
            setAreas(data.filter((area: AreaOption) => area.activo))
        } catch (error) {
            console.error('Error fetching areas:', error)
        }
    }

    const fetchPuestos = async (areaId: string) => {
        try {
            const res = await fetch(`/api/puestos?areaId=${areaId}`)
            const data = await res.json()
            setPuestos(data)
        } catch (error) {
            console.error('Error fetching puestos:', error)
        }
    }

    const fetchTurnos = async () => {
        try {
            const res = await fetch('/api/turnos')
            const data = await res.json()
            setTurnos(data.filter((shift: ShiftOption) => shift.activo))
        } catch (error) {
            console.error('Error fetching turnos:', error)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        const newFormData = { ...formData, [name]: value }

        // Si cambia horario, recalcular horas diarias
        if (name === 'horarioEntrada' || name === 'horarioSalida') {
            const horas = calculateHours(
                name === 'horarioEntrada' ? value : formData.horarioEntrada,
                name === 'horarioSalida' ? value : formData.horarioSalida
            )
            if (horas) {
                newFormData.horasTrabajoDiarias = horas
            }
        }

        // Si cambia el rolId, actualizar también el string 'rol' para compatibilidad legacy
        if (name === 'rolId') {
            const selectedRole = roles.find(r => r.id === value)
            if (selectedRole) {
                newFormData.rol = selectedRole.nombre
            } else if (value === '') {
                newFormData.rol = ''
            }
        }

        // Si cambia el área, limpiar el puesto (ya no es válido para la nueva área)
        if (name === 'areaId') {
            newFormData.puestoId = ''
        }

        setFormData(newFormData)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSave(formData)
            onClose()
        } catch (error: unknown) {
            console.error(error)
            alert(error instanceof Error ? error.message : 'Ocurrió un error al guardar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={`modal ${styles.employeeModal}`} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {isEdit ? 'Editar Empleado' : 'Nuevo Empleado'}
                    </h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            borderBottom: tab === 'personal' ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: tab === 'personal' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                            background: 'none',
                            borderTop: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            cursor: 'pointer'
                        }}
                        onClick={() => setTab('personal')}
                    >
                        Datos Personales
                    </button>
                    <button
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            borderBottom: tab === 'laboral' ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: tab === 'laboral' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                            background: 'none',
                            borderTop: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            cursor: 'pointer'
                        }}
                        onClick={() => setTab('laboral')}
                    >
                        Info. Laboral
                    </button>
                    <button
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            borderBottom: tab === 'salarial' ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: tab === 'salarial' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                            background: 'none',
                            borderTop: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            cursor: 'pointer'
                        }}
                        onClick={() => setTab('salarial')}
                    >
                        Salario y Config %
                    </button>
                    <button
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            borderBottom: tab === 'reloj' ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: tab === 'reloj' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                            background: 'none',
                            borderTop: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            cursor: 'pointer'
                        }}
                        onClick={() => setTab('reloj')}
                    >
                        Reloj Biométrico
                    </button>
                
                {isEdit && (
                    <>
                    <button
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            borderBottom: tab === 'documentos' ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: tab === 'documentos' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                            background: 'none',
                            borderTop: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            cursor: 'pointer'
                        }}
                        onClick={() => setTab('documentos')}
                    >
                        📄 Documentos
                    </button>
                    <button
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            borderBottom: tab === 'evaluaciones' ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: tab === 'evaluaciones' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                            background: 'none',
                            borderTop: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            cursor: 'pointer'
                        }}
                        onClick={() => setTab('evaluaciones')}
                    >
                        ⭐ Evaluaciones
                    </button>
                    </>
                )}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {/* Tab 1: Personal */}
                        {tab === 'personal' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Nombre</label>
                                    <input required type="text" name="nombre" value={formData.nombre} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Apellido</label>
                                    <input type="text" name="apellido" value={formData.apellido} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">DNI</label>
                                    <input type="text" name="dni" value={formData.dni} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Teléfono</label>
                                    <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Email</label>
                                    <input
                                    autoComplete="new-email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="form-input"
                                    />                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">
                                        {isEdit ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña (opcional para operarios regulares)'}
                                    </label>
                                    <input
                                    autoComplete="new-password"
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="form-input"
                                    />                                </div>
                            </div>
                        )}

                        {/* Tab 2: Laboral */}
                        {tab === 'laboral' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Tipo de empleado</label>
                                    <select name="rolId" value={formData.rolId} onChange={handleChange} className="form-select" required>
                                        <option value="">— Seleccionar un tipo —</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.nombre}</option>
                                        ))}
                                    </select>
                                    {!formData.rolId && <small style={{ color: 'var(--color-danger)', fontSize: '10px' }}>* Requerido para definir accesos y valores salariales de referencia.</small>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de Ingreso</label>
                                    <input type="date" name="fechaIngreso" value={formData.fechaIngreso} onChange={handleChange} onClick={(e) => e.currentTarget.showPicker?.()} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Días de Trabajo</label>
                                    <input type="text" name="diasTrabajoSemana" value={formData.diasTrabajoSemana} onChange={handleChange} placeholder="Ej: Lunes a Viernes" className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Horas Diarias Esperadas</label>
                                    <input type="number" step="0.5" name="horasTrabajoDiarias" value={formData.horasTrabajoDiarias} onChange={handleChange} className="form-input" />
                                </div>

                                {selectedRole && (
                                    <div className={styles.roleSummary} style={{ '--role-color': selectedRole.color || '#9b1c31' } as React.CSSProperties}>
                                        <div className={styles.roleSummaryHeader}>
                                            <div>
                                                <span>Configuración heredada</span>
                                                <strong>{selectedRole.nombre}</strong>
                                            </div>
                                            <span className={styles.inheritedBadge}>Activa</span>
                                        </div>
                                        <p>{selectedRole.descripcion || 'Este tipo define los accesos al sistema y los valores salariales de referencia.'}</p>
                                        <div className={styles.roleSummaryGrid}>
                                            <div><span>Accesos</span><strong>{permisosDelRol.length ? permisosDelRol.map(permission => permission.label).join(' · ') : 'Sin acceso al sistema'}</strong></div>
                                            <div><span>Base del tipo</span><strong>{selectedRole.jornal > 0 ? `$${selectedRole.jornal.toLocaleString('es-AR')} / ${selectedRole.cicloPago.toLowerCase()}` : 'Sin importe definido'}</strong></div>
                                            <div><span>Hora extra fija</span><strong>{selectedRole.valorHoraExtra > 0 ? `$${selectedRole.valorHoraExtra.toLocaleString('es-AR')}` : 'Cálculo automático'}</strong></div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Turno de Trabajo (Asistencia Avanzada)</label>
                                    <select name="turnoId" value={formData.turnoId} onChange={handleChange} className="form-select">
                                        <option value="">— Horario Personalizado (Abajo) —</option>
                                        {turnos.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.nombre} ({t.horaInicio} - {t.horaFin})
                                            </option>
                                        ))}
                                    </select>
                                    <small style={{ color: 'var(--color-gray-500)', fontSize: '10px' }}>
                                        Si selecciona un turno, las horas de entrada/salida de abajo se usarán solo como referencia secundaria.
                                    </small>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Horario Entrada (Referencia)</label>
                                    <input type="time" name="horarioEntrada" value={formData.horarioEntrada} onChange={handleChange} className="form-input" disabled={!!formData.turnoId} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Horario Salida (Referencia)</label>
                                    <input type="time" name="horarioSalida" value={formData.horarioSalida} onChange={handleChange} className="form-input" disabled={!!formData.turnoId} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Sede / Punto de Venta</label>
                                    <select name="ubicacionId" value={formData.ubicacionId} onChange={handleChange} className="form-select">
                                        <option value="">— Sin asignar —</option>
                                        {ubicaciones.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Área y Puesto */}
                                <div className="form-group">
                                    <label className="form-label">Área</label>
                                    <select name="areaId" value={formData.areaId} onChange={handleChange} className="form-select">
                                        <option value="">— Sin asignar —</option>
                                        {areas.map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Puesto</label>
                                    <select name="puestoId" value={formData.puestoId} onChange={handleChange} className="form-select" disabled={!formData.areaId}>
                                        <option value="">{formData.areaId ? '— Sin asignar —' : '— Seleccione área primero —'}</option>
                                        {puestos.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    {formData.areaId && puestos.length === 0 && (
                                        <small style={{ color: 'var(--color-gray-500)', fontSize: '10px' }}>No hay puestos en esta área. Créelos desde el Organigrama.</small>
                                    )}
                                </div>
                            </div>
                        )}

                        {tab === 'personal' && isEdit && (
                            <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--color-gray-100)', paddingTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-outline" 
                                    style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                                    onClick={() => setShowFinalModal(true)}
                                >
                                    ⚖️ Liquidación Final (Egreso)
                                </button>
                            </div>
                        )}

                        {/* Tab 3: Salarial */}
                        {tab === 'salarial' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className={styles.salarySource}>
                                    <div>
                                        <span className={styles.sourceEyebrow}>Origen de la remuneración</span>
                                        <h4>{usaBaseDelRol ? `Valores del tipo ${selectedRole?.nombre}` : 'Valores personalizados para esta persona'}</h4>
                                        <p>{usaBaseDelRol
                                            ? 'La ficha se actualiza automáticamente cuando cambia el monto del tipo de empleado.'
                                            : 'Estos importes reemplazan la referencia general sólo para este empleado.'}</p>
                                    </div>
                                    {selectedRole && (usaBaseDelRol ? (
                                        <button type="button" className="btn btn-outline" onClick={personalizarBaseSalarial}>Personalizar valores</button>
                                    ) : (
                                        <button type="button" className="btn btn-outline" onClick={usarBaseDelRol}>Volver a valores del tipo</button>
                                    ))}
                                </div>

                                {usaBaseDelRol && selectedRole ? (
                                    <div className={styles.inheritedSalary}>
                                        <div><span>Monto efectivo</span><strong>${Number(selectedRole.jornal || 0).toLocaleString('es-AR')}</strong></div>
                                        <div><span>Ciclo</span><strong>{selectedRole.cicloPago}</strong></div>
                                        <div><span>Hora extra</span><strong>{selectedRole.valorHoraExtra > 0 ? `$${selectedRole.valorHoraExtra.toLocaleString('es-AR')}` : 'Automática'}</strong></div>
                                    </div>
                                ) : <>
                                <div className="form-group">
                                    <label className="form-label">Remuneración por Periodo ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={montoInput}
                                        onChange={(e) => {
                                            const valStr = e.target.value
                                            setMontoInput(valStr)
                                            const val = parseFloat(valStr) || 0
                                            
                                            if (formData.cicloPago === 'DIARIO') {
                                                setFormData(prev => ({ ...prev, jornal: val.toString(), sueldoBaseMensual: (val * 30).toString() }))
                                            } else {
                                                let monthly = val
                                                if (formData.cicloPago === 'SEMANAL') monthly = val * 4.3
                                                if (formData.cicloPago === 'QUINCENAL') monthly = val * 2
                                                setFormData(prev => ({ ...prev, sueldoBaseMensual: monthly.toString(), jornal: '0' }))
                                            }
                                        }}
                                        className="form-input"
                                        placeholder="Ingrese el monto que cobra en mano por ciclo"
                                    />
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                                        {formData.cicloPago === 'DIARIO' ? 'Monto por día trabajado.' : 'Ej: Si cobra $50.000 x semana, ingrese 50000.'}
                                    </p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ciclo de Cobro</label>
                                    <select
                                        name="cicloPago"
                                        value={formData.cicloPago}
                                        onChange={(e) => {
                                            const newCiclo = e.target.value
                                            const monthly = parseFloat(formData.sueldoBaseMensual) || 0
                                            const daily = parseFloat(formData.jornal) || 0
                                            
                                            let newMonto = 0
                                            if (newCiclo === 'DIARIO') newMonto = daily > 0 ? daily : (monthly / 30)
                                            else if (newCiclo === 'SEMANAL') newMonto = monthly / 4.3
                                            else if (newCiclo === 'QUINCENAL') newMonto = monthly / 2
                                            else newMonto = monthly
                                            
                                            setMontoInput(newMonto.toFixed(2))
                                            setFormData(prev => ({ ...prev, cicloPago: newCiclo }))
                                        }}
                                        className="form-select"
                                    >
                                        <option value="DIARIO">DIARIO (Personalizado)</option>
                                        <option value="SEMANAL">SEMANAL (x4.3)</option>
                                        <option value="QUINCENAL">QUINCENAL (x2)</option>
                                        <option value="MENSUAL">MENSUAL</option>
                                    </select>
                                </div>
                                </>}
                                <div className="form-group" style={{ gridColumn: '1 / -1', padding: 'var(--space-4)', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', background: 'var(--color-gray-50)' }}>
                                    <label className="form-label">Modalidad de liquidación y pago</label>
                                    <select name="modalidadPago" value={formData.modalidadPago} onChange={handleChange} className="form-select">
                                        <option value="SEMANAL_EFECTIVO">Semanal habitual</option>
                                        <option value="MENSUAL_MIXTA">Mensual mixta: transferencia del recibo + diferencia en efectivo</option>
                                    </select>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', marginTop: 6, marginBottom: 0 }}>
                                        {formData.modalidadPago === 'MENSUAL_MIXTA'
                                            ? 'Se acumula por días del mes calendario. La empleada se excluye de los pagos semanales, masivos y Express.'
                                            : 'Se mantiene el circuito actual de liquidación semanal.'}
                                    </p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valor Hora Extra (%)</label>
                                    <div style={{ display: 'flex' }}>
                                        <span style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px solid var(--color-gray-300)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', color: 'var(--color-gray-500)' }}>+</span>
                                        <input type="number" name="porcentajeHoraExtra" value={formData.porcentajeHoraExtra} onChange={handleChange} className="form-input" style={{ borderRadius: 0 }} />
                                        <span style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px solid var(--color-gray-300)', borderLeft: 'none', borderRadius: '0 var(--radius-md) var(--radius-md) 0', color: 'var(--color-gray-500)' }}>%</span>
                                    </div>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>Gralmente 50% (días hábiles) o 100% (findes).</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valor Feriado (%)</label>
                                    <div style={{ display: 'flex' }}>
                                        <span style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px solid var(--color-gray-300)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', color: 'var(--color-gray-500)' }}>+</span>
                                        <input type="number" name="porcentajeFeriado" value={formData.porcentajeFeriado} onChange={handleChange} className="form-input" style={{ borderRadius: 0 }} />
                                        <span style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px solid var(--color-gray-300)', borderLeft: 'none', borderRadius: '0 var(--radius-md) var(--radius-md) 0', color: 'var(--color-gray-500)' }}>%</span>
                                    </div>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>Gralmente 100% adicional sobre hs base.</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valor Hora Extra ($)</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }}>$</span>
                                        <input type="number" step="0.01" name="valorHoraExtra" value={formData.valorHoraExtra} onChange={handleChange} className="form-input" style={{ paddingLeft: '25px' }} />
                                    </div>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                                        {selectedRole?.valorHoraExtra && Number(formData.valorHoraExtra) <= 0
                                            ? `En cero, hereda $${selectedRole.valorHoraExtra.toLocaleString('es-AR')} del tipo ${selectedRole.nombre}.`
                                            : 'Monto fijo individual por cada hora extra. En cero, se calcula automáticamente.'}
                                    </p>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1', backgroundColor: 'var(--color-success-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)' }}>
                                    <label className="form-label" style={{ color: 'var(--color-gray-800)', fontWeight: 600 }}>Sueldo mensual efectivo proyectado:</label>
                                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                        ${usaBaseDelRol && selectedRole
                                            ? (selectedRole.cicloPago === 'MENSUAL' ? selectedRole.jornal : selectedRole.cicloPago === 'SEMANAL' ? selectedRole.jornal * 4.3 : selectedRole.jornal * 30).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            : (parseFloat(formData.sueldoBaseMensual) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', marginTop: 'var(--space-1)' }}>
                                        {usaBaseDelRol && selectedRole
                                            ? `Calculado con la referencia ${selectedRole.cicloPago.toLowerCase()} del tipo de empleado.`
                                            : formData.cicloPago === 'DIARIO'
                                            ? 'Personalizado: Valor día directo.'
                                            : formData.cicloPago === 'SEMANAL'
                                                ? 'Calculado como: Monto semanal × 4.3 semanas'
                                                : formData.cicloPago === 'QUINCENAL'
                                                    ? 'Calculado como: Monto quincenal × 2 quincenas'
                                                    : 'Se toma el monto mensual directo.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Tab 4: Reloj */}
                        {tab === 'reloj' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <div style={{ backgroundColor: 'var(--color-info-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-info)' }}>
                                    <h4 style={{ color: 'var(--color-info)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Vinculación con Reloj Biométrico
                                    </h4>
                                    <p style={{ fontSize: 'var(--text-sm)', color: '#1E40AF', marginTop: 'var(--space-1)' }}>Ingrese el código interno que tiene asignado este empleado en el dispositivo de fichada. Este código se usará para emparejar automáticamente la importación de horas semanales.</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Código Biométrico (ID en Reloj)</label>
                                    <input type="text" name="codigoBiometrico" value={formData.codigoBiometrico} onChange={handleChange} placeholder="Ej: 001, 1044, etc" className="form-input" />
                                </div>
                            </div>
                        )}

                        {/* Tab 5: Documentos */}
                        {tab === 'documentos' && isEdit && (
                            <DocumentosTab empleadoId={empleado.id} />
                        )}

                        {/* Tab 6: Evaluaciones */}
                        {tab === 'evaluaciones' && isEdit && (
                            <EvaluacionesTab empleadoId={empleado.id} />
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-ghost">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? 'Guardando...' : 'Guardar Empleado'}
                        </button>
                    </div>
                </form>

                {showFinalModal && (
                    <LiquidacionFinalModal
                        empleado={empleado}
                        onClose={() => setShowFinalModal(false)}
                        onSuccess={() => {
                            setShowFinalModal(false)
                            onClose()
                        }}
                    />
                )}
            </div>
        </div>
    )
}
