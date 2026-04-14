'use client'

import React from 'react'
import { MESES } from '../utils/dateUtils'

export type SeccionReporte = 'dashboard' | 'produccion' | 'ventas' | 'costos' | 'desperdicio' | 'performance'

interface Ubicacion {
    id: string
    nombre: string
    tipo: string
}

interface PeriodoSelectorProps {
    mes: string
    anio: string
    ubicacionId: string
    activeSection: SeccionReporte
    loading: boolean
    ubicaciones: Ubicacion[]
    anios: string[]
    onMesChange: (mes: string) => void
    onAnioChange: (anio: string) => void
    onUbicacionChange: (id: string) => void
    onSectionChange: (section: SeccionReporte) => void
    onRefresh: () => void
    onExport: () => void
    onOpenSettings: () => void
}

const SECCIONES: { key: SeccionReporte; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'produccion', label: 'Producción', icon: '🏭' },
    { key: 'ventas', label: 'Ventas', icon: '💰' },
    { key: 'costos', label: 'Costos', icon: '📉' },
    { key: 'desperdicio', label: 'Desperdicio', icon: '🗑️' },
    { key: 'performance', label: 'Performance', icon: '⚡' },
]

export default function PeriodoSelector({
    mes,
    anio,
    ubicacionId,
    activeSection,
    loading,
    ubicaciones,
    anios,
    onMesChange,
    onAnioChange,
    onUbicacionChange,
    onSectionChange,
    onRefresh,
    onExport,
    onOpenSettings
}: PeriodoSelectorProps) {
    return (
        <div style={{ marginBottom: 'var(--space-6)' }}>
            {/* Header row: Title + Filters */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-4)'
            }}>
                <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>📊 Reportes de Gestión</h1>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        className="form-select"
                        value={ubicacionId}
                        onChange={e => onUbicacionChange(e.target.value)}
                        style={{ width: 150 }}
                        disabled={loading}
                    >
                        <option value="">Todas las Sedes</option>
                        {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>

                    <select
                        className="form-select"
                        value={mes}
                        onChange={e => onMesChange(e.target.value)}
                        style={{ width: 130 }}
                        disabled={loading}
                    >
                        {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>

                    <select
                        className="form-select"
                        value={anio}
                        onChange={e => onAnioChange(e.target.value)}
                        style={{ width: 85 }}
                        disabled={loading}
                    >
                        {anios.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>

                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={onRefresh}
                        disabled={loading}
                        title="Refrescar"
                        style={{ padding: '4px 8px', fontSize: '18px' }}
                    >
                        🔄
                    </button>

                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={onOpenSettings}
                        title="Configurar"
                        style={{ padding: '4px 8px', fontSize: '18px' }}
                    >
                        ⚙️
                    </button>

                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onExport}
                        disabled={loading}
                        title="Exportar Excel"
                        style={{ padding: '4px 12px' }}
                    >
                        📤 Excel
                    </button>
                </div>
            </div>

            {/* Section tabs */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-1)',
                overflowX: 'auto',
                paddingBottom: 'var(--space-2)',
                borderBottom: '2px solid var(--color-gray-200)'
            }}>
                {SECCIONES.map(sec => {
                    const isActive = activeSection === sec.key
                    return (
                        <button
                            key={sec.key}
                            onClick={() => onSectionChange(sec.key)}
                            style={{
                                padding: 'var(--space-2) var(--space-4)',
                                border: 'none',
                                background: isActive ? 'var(--color-primary)' : 'transparent',
                                color: isActive ? 'white' : 'var(--color-gray-600)',
                                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-ui)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: isActive ? 700 : 500,
                                whiteSpace: 'nowrap',
                                transition: 'all var(--transition-fast)',
                                marginBottom: '-2px',
                                borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent'
                            }}
                        >
                            <span style={{ marginRight: 'var(--space-1)' }}>{sec.icon}</span>
                            {sec.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
