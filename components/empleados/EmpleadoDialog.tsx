"use client"

import { useState, useEffect } from 'react'
import { Empleado } from '@prisma/client'
import DocumentosTab from './DocumentosTab'
import EvaluacionesTab from './EvaluacionesTab'

interface EmpleadoDialogProps {
    empleado?: any
    onSave: (data: any) => Promise<void>
    onClose: () => void
}

export function EmpleadoDialog({ empleado, onSave, onClose }: EmpleadoDialogProps) {
    const isEdit = !!empleado
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState('personal')
    const [roles, setRoles] = useState<any[]>([])
    const [ubicaciones, setUbicaciones] = useState<any[]>([])
    const [areas, setAreas] = useState<any[]>([])
    const [puestos, setPuestos] = useState<any[]>([])
    const [turnos, setTurnos] = useState<any[]>([])

    // Estado local del form
    const [formData, setFormData] = useState({
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
                if (data.length > 0 && !formData.rolId && formData.rol) {
                    const match = data.find((r: any) => r.nombre === formData.rol)
                    if (match) {
                        setFormData(prev => ({ ...prev, rolId: match.id }))
                    }
                }
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
            setAreas(data.filter((a: any) => a.activo))
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
            setTurnos(data.filter((t: any) => t.activo))
        } catch (error) {
            console.error('Error fetching turnos:', error)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        let newFormData = { ...formData, [name]: value }

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
        } catch (error: any) {
            console.error(error)
            alert(error.message || 'Ocurrió un error al guardar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <div className="modal-header">
                    <h2>
                        {isEdit ? 'Editar Empleado' : 'Nuevo Empleado'}
                    </h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', backgroundColor: 'var(--color-gray-50)', padding: '0 var(--space-4)' }}>
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
                                    <label className="form-label">Rol / Especialidad</label>
                                    <select name="rolId" value={formData.rolId} onChange={handleChange} className="form-select">
                                        <option value="">— Seleccionar un Rol —</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.nombre}</option>
                                        ))}
                                    </select>
                                    {!formData.rolId && <small style={{ color: 'var(--color-danger)', fontSize: '10px' }}>* Requerido para automatizar salarios</small>}
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

                        {/* Tab 3: Salarial */}
                        {tab === 'salarial' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>Monto fijo por cada hora extra. Se usa en Liquidación Express.</p>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1', backgroundColor: 'var(--color-success-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)' }}>
                                    <label className="form-label" style={{ color: 'var(--color-gray-800)', fontWeight: 600 }}>Sueldo Base Mensual Proyectado (en DB):</label>
                                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                        ${(parseFloat(formData.sueldoBaseMensual) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', marginTop: 'var(--space-1)' }}>
                                        {formData.cicloPago === 'DIARIO'
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
            </div>
        </div>
    )
}
