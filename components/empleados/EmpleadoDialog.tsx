"use client"

import { useState, useEffect } from 'react'
import { Empleado } from '@prisma/client'

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
        valorHoraExtra: empleado?.valorHoraExtra?.toString() || '0'
    })

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await fetch('/api/empleados/roles')
                const data = await res.json()
                setRoles(data)
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
    }, [])

    // Estado local para el input de remuneración para que no "salte" con los decimales mientras tipea
    const initialMonto = (
        formData.cicloPago === 'SEMANAL'
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

        // Si cambia el rol, actualizar también el rolId
        if (name === 'rol') {
            const selectedRole = roles.find(r => r.nombre === value)
            if (selectedRole) {
                newFormData.rolId = selectedRole.id
            }
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
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">
                                        {isEdit ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña (opcional para operarios regulares)'}
                                    </label>
                                    <input type="password" name="password" value={formData.password} onChange={handleChange} className="form-input" />
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Laboral */}
                        {tab === 'laboral' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Rol</label>
                                    <select name="rol" value={formData.rol} onChange={handleChange} className="form-select">
                                        {roles.length > 0 ? (
                                            roles.map(r => (
                                                <option key={r.id} value={r.nombre}>{r.nombre}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="OPERARIO">OPERARIO</option>
                                                <option value="LOGISTICA">LOGÍSTICA / CHOFER</option>
                                                <option value="COORD_PROD">COORD. PRODUCCIÓN</option>
                                                <option value="ADMIN_OPS">ADMINISTRATIVO</option>
                                                <option value="ADMIN">ADMIN GENERAL</option>
                                            </>
                                        )}
                                    </select>
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
                                <div className="form-group">
                                    <label className="form-label">Horario Entrada</label>
                                    <input type="time" name="horarioEntrada" value={formData.horarioEntrada} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Horario Salida</label>
                                    <input type="time" name="horarioSalida" value={formData.horarioSalida} onChange={handleChange} className="form-input" />
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
                                            let monthly = val
                                            if (formData.cicloPago === 'SEMANAL') monthly = val * 4.3
                                            if (formData.cicloPago === 'QUINCENAL') monthly = val * 2
                                            setFormData(prev => ({ ...prev, sueldoBaseMensual: monthly.toString() }))
                                        }}
                                        className="form-input"
                                        placeholder="Ingrese el monto que cobra en mano por ciclo"
                                    />
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>Ej: Si cobra $50.000 x semana, ingrese 50000.</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ciclo de Cobro</label>
                                    <select
                                        name="cicloPago"
                                        value={formData.cicloPago}
                                        onChange={(e) => {
                                            const newCiclo = e.target.value
                                            // Al cambiar el ciclo, recalculamos el montoInput basado en el sueldoBaseMensual actual
                                            const monthly = parseFloat(formData.sueldoBaseMensual) || 0
                                            let newMonto = monthly
                                            if (newCiclo === 'SEMANAL') newMonto = monthly / 4.3
                                            if (newCiclo === 'QUINCENAL') newMonto = monthly / 2
                                            setMontoInput(newMonto.toFixed(2))
                                            setFormData(prev => ({ ...prev, cicloPago: newCiclo }))
                                        }}
                                        className="form-select"
                                    >
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
                                        {formData.cicloPago === 'SEMANAL'
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
