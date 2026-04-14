'use client'

import React, { useState, useEffect } from 'react'
import { MESES, GranularidadTemporal, RangoFechas, getDateRange } from '../utils/dateUtils'

export type SeccionReporte = 'dashboard' | 'produccion' | 'ventas' | 'costos' | 'desperdicio' | 'performance'

interface Ubicacion {
    id: string
    nombre: string
    tipo: string
}

interface PeriodoSelectorProps {
    granularidad: GranularidadTemporal
    rango: RangoFechas
    ubicacionId: string
    activeSection: SeccionReporte
    loading: boolean
    ubicaciones: Ubicacion[]
    anios: string[]
    onGranularidadChange: (gran: GranularidadTemporal) => void
    onRangoChange: (rango: RangoFechas) => void
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
    granularidad,
    rango,
    ubicacionId,
    activeSection,
    loading,
    ubicaciones,
    anios,
    onGranularidadChange,
    onRangoChange,
    onUbicacionChange,
    onSectionChange,
    onRefresh,
    onExport,
    onOpenSettings
}: PeriodoSelectorProps) {

    // Helper states for individual selectors
    const [mesTemp, setMesTemp] = useState(rango.desde.getMonth() + 1)
    const [anioTemp, setAnioTemp] = useState(rango.desde.getFullYear())
    const [fechaDia, setFechaDia] = useState(rango.desde.toISOString().slice(0,10))
    const [fechaSemana, setFechaSemana] = useState(rango.desde.toISOString().slice(0,10))
    const [customDesde, setCustomDesde] = useState(rango.desde.toISOString().slice(0,10))
    const [customHasta, setCustomHasta] = useState(rango.hasta.toISOString().slice(0,10))

    // Automatically recalculate Rango when temps change
    useEffect(() => {
        if (granularidad === 'mes') {
            onRangoChange(getDateRange('mes', { mes: mesTemp, anio: anioTemp }))
        } else if (granularidad === 'dia') {
            onRangoChange(getDateRange('dia', { fecha: fechaDia }))
        } else if (granularidad === 'semana') {
            onRangoChange(getDateRange('semana', { fecha: fechaSemana })) // Re-using fecha as reference for week
        } else if (granularidad === 'rango') {
            if (customDesde && customHasta) {
                onRangoChange(getDateRange('rango', { rangoDesde: customDesde, rangoHasta: customHasta }))
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mesTemp, anioTemp, fechaDia, fechaSemana, customDesde, customHasta])

    return (
        <div style={{ marginBottom: 'var(--space-6)' }}>
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
                        style={{ width: 140 }}
                        disabled={loading}
                    >
                        <option value="">Todas las Sedes</option>
                        {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>

                    <select
                        className="form-select"
                        value={granularidad}
                        onChange={e => onGranularidadChange(e.target.value as GranularidadTemporal)}
                        style={{ width: 110 }}
                        disabled={loading}
                    >
                        <option value="dia">Por Día</option>
                        <option value="semana">Por Semana</option>
                        <option value="mes">Por Mes</option>
                        <option value="rango">Rango</option>
                    </select>

                    {granularidad === 'mes' && (
                        <>
                            <select
                                className="form-select"
                                value={mesTemp}
                                onChange={e => setMesTemp(Number(e.target.value))}
                                style={{ width: 110 }}
                                disabled={loading}
                            >
                                {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <select
                                className="form-select"
                                value={anioTemp}
                                onChange={e => setAnioTemp(Number(e.target.value))}
                                style={{ width: 85 }}
                                disabled={loading}
                            >
                                {anios.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </>
                    )}

                    {granularidad === 'dia' && (
                        <input 
                            type="date"
                            className="form-input"
                            value={fechaDia}
                            onChange={e => setFechaDia(e.target.value)}
                            disabled={loading}
                            max={new Date().toISOString().slice(0,10)}
                        />
                    )}

                    {granularidad === 'semana' && (
                        <input 
                            type="date"
                            className="form-input"
                            value={fechaSemana}
                            onChange={e => setFechaSemana(e.target.value)}
                            disabled={loading}
                            title="Selecciona cualquier día de la semana deseada"
                            max={new Date().toISOString().slice(0,10)}
                        />
                    )}

                    {granularidad === 'rango' && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <input 
                                type="date"
                                className="form-input"
                                value={customDesde}
                                onChange={e => setCustomDesde(e.target.value)}
                                disabled={loading}
                            />
                            <span>a</span>
                            <input 
                                type="date"
                                className="form-input"
                                value={customHasta}
                                onChange={e => setCustomHasta(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    )}

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
            
            {/* Range Label Feedback */}
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                Mostrando datos para: <strong>{rango.label}</strong>
            </div>
        </div>
    )
}
