"use client"

import { useState } from 'react'
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
        codigoBiometrico: empleado?.codigoBiometrico || ''
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSave(formData)
            onClose()
        } catch (error) {
            console.error(error)
            alert('Ocurrió un error al guardar')
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
                                    <input required type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" />
                                </div>
                                {!isEdit && (
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Contraseña (opcional para operarios regulares)</label>
                                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="form-input" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 2: Laboral */}
                        {tab === 'laboral' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Rol</label>
                                    <select name="rol" value={formData.rol} onChange={handleChange} className="form-select">
                                        <option value="OPERARIO">OPERARIO</option>
                                        <option value="LOGISTICA">LOGÍSTICA / CHOFER</option>
                                        <option value="COORD_PROD">COORD. PRODUCCIÓN</option>
                                        <option value="ADMIN_OPS">ADMINISTRATIVO</option>
                                        <option value="ADMIN">ADMIN GENERAL</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de Ingreso</label>
                                    <input type="date" name="fechaIngreso" value={formData.fechaIngreso} onChange={handleChange} className="form-input" />
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
                            </div>
                        )}

                        {/* Tab 3: Salarial */}
                        {tab === 'salarial' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="form-group">
                                    <label className="form-label">Sueldo Base Mensual ($)</label>
                                    <input type="number" step="0.01" name="sueldoBaseMensual" value={formData.sueldoBaseMensual} onChange={handleChange} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ciclo de Cobro</label>
                                    <select name="cicloPago" value={formData.cicloPago} onChange={handleChange} className="form-select">
                                        <option value="SEMANAL">SEMANAL</option>
                                        <option value="QUINCENAL">QUINCENAL</option>
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
                                <div className="form-group" style={{ gridColumn: '1 / -1', backgroundColor: 'var(--color-success-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)' }}>
                                    <label className="form-label" style={{ color: 'var(--color-gray-800)', fontWeight: 600 }}>Sueldo proporcional a pagar por periodo ({formData.cicloPago}):</label>
                                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                        ${(
                                            formData.cicloPago === 'SEMANAL'
                                                ? (parseFloat(formData.sueldoBaseMensual) || 0) / 4.3
                                                : formData.cicloPago === 'QUINCENAL'
                                                    ? (parseFloat(formData.sueldoBaseMensual) || 0) / 2
                                                    : (parseFloat(formData.sueldoBaseMensual) || 0)
                                        ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', marginTop: 'var(--space-1)' }}>
                                        {formData.cicloPago === 'SEMANAL'
                                            ? 'Calculado como: Sueldo Base Mensual ÷ 4.3'
                                            : formData.cicloPago === 'QUINCENAL'
                                                ? 'Calculado como: Sueldo Base Mensual ÷ 2'
                                                : 'El recibo se emitirá por el total mensual ingresado.'}
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
