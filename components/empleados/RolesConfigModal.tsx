"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './RolesConfigModal.module.css'

type PermissionKey =
    | 'permisoDashboard'
    | 'permisoStock'
    | 'permisoCaja'
    | 'permisoPersonal'
    | 'permisoProduccion'
    | 'permisoCostos'
    | 'permisoAtencion'
    | 'permisoAtencionAdmin'

interface Role {
    id: string
    nombre: string
    descripcion: string | null
    color: string | null
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
    _count?: { empleados: number }
}

interface RolesConfigModalProps {
    onClose: () => void
    onRolesChanged: () => void
}

const PERMISSIONS: Array<{ id: PermissionKey; title: string; description: string; icon: string }> = [
    { id: 'permisoDashboard', title: 'Dashboard', description: 'Indicadores generales y pantalla de inicio.', icon: '⌂' },
    { id: 'permisoStock', title: 'Stock y compras', description: 'Insumos, compras, proveedores e inventario.', icon: '□' },
    { id: 'permisoCaja', title: 'Caja', description: 'Saldos, movimientos y rendiciones.', icon: '$' },
    { id: 'permisoPersonal', title: 'Personal', description: 'Legajos, asistencia y liquidaciones.', icon: '●' },
    { id: 'permisoProduccion', title: 'Producción', description: 'Lotes, recetas y operación diaria.', icon: '△' },
    { id: 'permisoCostos', title: 'Costos', description: 'Costeo, rentabilidad y reportes.', icon: '%' },
    { id: 'permisoAtencion', title: 'Atención', description: 'Bandeja, conversaciones y respuesta a clientes.', icon: '@' },
    { id: 'permisoAtencionAdmin', title: 'Supervisión de atención', description: 'Configuración, reasignaciones y métricas del equipo.', icon: '★' },
]

const EMPTY_ROLE: Partial<Role> = {
    nombre: '',
    descripcion: '',
    color: '#9b1c31',
    permisoDashboard: false,
    permisoStock: false,
    permisoCaja: false,
    permisoPersonal: false,
    permisoProduccion: false,
    permisoCostos: false,
    permisoAtencion: false,
    permisoAtencionAdmin: false,
    jornal: 0,
    valorHoraExtra: 0,
    cicloPago: 'SEMANAL',
}

const money = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 })

export default function RolesConfigModal({ onClose, onRolesChanged }: RolesConfigModalProps) {
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editRole, setEditRole] = useState<Partial<Role> | null>(null)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    const fetchRoles = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/empleados/roles')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los tipos de empleado.')
            setRoles(Array.isArray(data) ? data : [])
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudieron cargar los tipos de empleado.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchRoles()
    }, [fetchRoles])

    const visibleRoles = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return roles
        return roles.filter(role => `${role.nombre} ${role.descripcion || ''}`.toLowerCase().includes(term))
    }, [roles, search])

    const assignedEmployees = roles.reduce((total, role) => total + (role._count?.empleados || 0), 0)
    const enabledPermissions = editRole
        ? PERMISSIONS.filter(permission => Boolean(editRole[permission.id])).length
        : 0

    const updateRole = <K extends keyof Role>(key: K, value: Role[K]) => {
        setEditRole(current => current ? { ...current, [key]: value } : current)
        setError('')
    }

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!editRole?.nombre?.trim()) {
            setError('Ingresá un nombre para el tipo de empleado.')
            return
        }
        setSaving(true)
        setError('')
        try {
            const url = editRole.id ? `/api/empleados/roles/${editRole.id}` : '/api/empleados/roles'
            const res = await fetch(url, {
                method: editRole.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editRole),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar el tipo de empleado.')
            setEditRole(data)
            await fetchRoles()
            onRolesChanged()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudo guardar el tipo de empleado.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (role: Role) => {
        const count = role._count?.empleados || 0
        if (count > 0) {
            setError(`No se puede eliminar ${role.nombre}: tiene ${count} empleado${count === 1 ? '' : 's'} asignado${count === 1 ? '' : 's'}.`)
            return
        }
        if (!window.confirm(`¿Eliminar el tipo de empleado “${role.nombre}”? Esta acción no se puede deshacer.`)) return
        setSaving(true)
        setError('')
        try {
            const res = await fetch(`/api/empleados/roles/${role.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el tipo de empleado.')
            if (editRole?.id === role.id) setEditRole(null)
            await fetchRoles()
            onRolesChanged()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudo eliminar el tipo de empleado.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className={styles.overlay} onMouseDown={onClose}>
            <section className={styles.modal} onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="roles-title">
                <header className={styles.header}>
                    <div>
                        <span className={styles.eyebrow}>Configuración de Personal</span>
                        <h2 id="roles-title">Tipos de empleado</h2>
                        <p>Centralizá accesos y valores salariales base. Cada empleado hereda la configuración del tipo que tenga asignado.</p>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">×</button>
                </header>

                <div className={styles.stats}>
                    <div><strong>{roles.length}</strong><span>Tipos configurados</span></div>
                    <div><strong>{assignedEmployees}</strong><span>Empleados vinculados</span></div>
                    <div><strong>{roles.filter(role => PERMISSIONS.some(permission => role[permission.id])).length}</strong><span>Con acceso al sistema</span></div>
                </div>

                {error && <div className={styles.error} role="alert">{error}</div>}

                <div className={styles.workspace}>
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarTop}>
                            <label className={styles.searchBox}>
                                <span>⌕</span>
                                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar tipo…" />
                            </label>
                            <button type="button" className="btn btn-primary" onClick={() => { setEditRole({ ...EMPTY_ROLE }); setError('') }}>
                                + Nuevo tipo
                            </button>
                        </div>

                        <div className={styles.roleList}>
                            {loading ? <div className={styles.empty}>Cargando tipos…</div> : visibleRoles.length === 0 ? (
                                <div className={styles.empty}>No hay tipos que coincidan con la búsqueda.</div>
                            ) : visibleRoles.map(role => {
                                const permissionCount = PERMISSIONS.filter(permission => role[permission.id]).length
                                const selected = editRole?.id === role.id
                                return (
                                    <button
                                        type="button"
                                        key={role.id}
                                        className={`${styles.roleCard} ${selected ? styles.roleCardSelected : ''}`}
                                        onClick={() => { setEditRole({ ...role }); setError('') }}
                                    >
                                        <span className={styles.colorMark} style={{ backgroundColor: role.color || '#9b1c31' }} />
                                        <span className={styles.roleCardBody}>
                                            <span className={styles.roleCardHeader}>
                                                <strong>{role.nombre}</strong>
                                                <span>{role._count?.empleados || 0} pers.</span>
                                            </span>
                                            <small>{role.descripcion || 'Sin descripción'}</small>
                                            <span className={styles.roleMeta}>
                                                <span>{permissionCount} acceso{permissionCount === 1 ? '' : 's'}</span>
                                                <span>{role.jornal > 0 ? `$${money(role.jornal)} / ${role.cicloPago.toLowerCase()}` : 'Sin base salarial'}</span>
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </aside>

                    <main className={styles.editor}>
                        {!editRole ? (
                            <div className={styles.welcome}>
                                <div className={styles.welcomeIcon}>R</div>
                                <h3>Seleccioná un tipo de empleado</h3>
                                <p>Podrás revisar quiénes lo usan, qué módulos habilita y qué valores toma como referencia cada ficha.</p>
                                <button type="button" className="btn btn-primary" onClick={() => setEditRole({ ...EMPTY_ROLE })}>Crear el primer tipo</button>
                            </div>
                        ) : (
                            <form onSubmit={handleSave} className={styles.form}>
                                <div className={styles.editorHeading}>
                                    <div>
                                        <span className={styles.eyebrow}>{editRole.id ? 'Editando tipo' : 'Nuevo tipo'}</span>
                                        <h3>{editRole.nombre || 'Sin nombre'}</h3>
                                    </div>
                                    {editRole.id && (
                                        <span className={styles.employeeCount}>{editRole._count?.empleados || 0} empleado{(editRole._count?.empleados || 0) === 1 ? '' : 's'}</span>
                                    )}
                                </div>

                                <section className={styles.section}>
                                    <div className={styles.sectionHeading}>
                                        <div><h4>Identidad del tipo</h4><p>Nombre y referencia visual que aparecerán en las fichas.</p></div>
                                    </div>
                                    <div className={styles.identityGrid}>
                                        <label className={styles.field}>
                                            <span>Nombre</span>
                                            <input className="form-input" value={editRole.nombre || ''} onChange={event => updateRole('nombre', event.target.value.toUpperCase())} placeholder="EJ: ADMINISTRACIÓN" required />
                                        </label>
                                        <label className={styles.colorField}>
                                            <span>Color</span>
                                            <span className={styles.colorControl}>
                                                <input type="color" value={editRole.color || '#9b1c31'} onChange={event => updateRole('color', event.target.value)} />
                                                <code>{editRole.color || '#9b1c31'}</code>
                                            </span>
                                        </label>
                                        <label className={`${styles.field} ${styles.fullWidth}`}>
                                            <span>Descripción</span>
                                            <textarea className="form-input" rows={2} value={editRole.descripcion || ''} onChange={event => updateRole('descripcion', event.target.value)} placeholder="Responsabilidades o alcance de este tipo de empleado." />
                                        </label>
                                    </div>
                                </section>

                                <section className={styles.section}>
                                    <div className={styles.sectionHeading}>
                                        <div><h4>Accesos al sistema</h4><p>Estos permisos se heredan automáticamente en todas las fichas vinculadas.</p></div>
                                        <span className={styles.counter}>{enabledPermissions} de {PERMISSIONS.length}</span>
                                    </div>
                                    <div className={styles.permissionsGrid}>
                                        {PERMISSIONS.map(permission => {
                                            const checked = Boolean(editRole[permission.id])
                                            return (
                                                <label key={permission.id} className={`${styles.permissionCard} ${checked ? styles.permissionCardActive : ''}`}>
                                                    <input type="checkbox" checked={checked} onChange={event => updateRole(permission.id, event.target.checked)} />
                                                    <span className={styles.permissionIcon}>{permission.icon}</span>
                                                    <span><strong>{permission.title}</strong><small>{permission.description}</small></span>
                                                    <span className={styles.switch} aria-hidden="true"><span /></span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </section>

                                <section className={styles.section}>
                                    <div className={styles.sectionHeading}>
                                        <div><h4>Valores salariales de referencia</h4><p>Se usan únicamente cuando la ficha del empleado no tiene un valor personalizado.</p></div>
                                        <span className={styles.inheritanceBadge}>Base heredable</span>
                                    </div>
                                    <div className={styles.salaryGrid}>
                                        <label className={styles.field}>
                                            <span>Monto base por período</span>
                                            <div className={styles.moneyInput}><b>$</b><input type="number" min="0" step="0.01" value={editRole.jornal ?? 0} onChange={event => updateRole('jornal', Number(event.target.value))} /></div>
                                        </label>
                                        <label className={styles.field}>
                                            <span>Período de referencia</span>
                                            <select className="form-select" value={editRole.cicloPago || 'SEMANAL'} onChange={event => updateRole('cicloPago', event.target.value)}>
                                                <option value="DIARIO">Diario</option>
                                                <option value="SEMANAL">Semanal</option>
                                                <option value="MENSUAL">Mensual</option>
                                            </select>
                                        </label>
                                        <label className={styles.field}>
                                            <span>Valor fijo de hora extra</span>
                                            <div className={styles.moneyInput}><b>$</b><input type="number" min="0" step="0.01" value={editRole.valorHoraExtra ?? 0} onChange={event => updateRole('valorHoraExtra', Number(event.target.value))} /></div>
                                            <small>En cero, se calcula según la jornada del empleado.</small>
                                        </label>
                                    </div>
                                </section>

                                <footer className={styles.formFooter}>
                                    <div>
                                        {editRole.id && (
                                            <button type="button" className={styles.deleteButton} disabled={saving || (editRole._count?.empleados || 0) > 0} onClick={() => void handleDelete(editRole as Role)}>
                                                Eliminar tipo
                                            </button>
                                        )}
                                    </div>
                                    <div className={styles.footerActions}>
                                        <button type="button" className="btn btn-ghost" onClick={() => setEditRole(null)} disabled={saving}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                                    </div>
                                </footer>
                            </form>
                        )}
                    </main>
                </div>
            </section>
        </div>
    )
}
