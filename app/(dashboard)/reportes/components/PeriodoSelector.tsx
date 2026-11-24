'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { MESES, GranularidadTemporal, RangoFechas, getDateRange } from '../utils/dateUtils'

const InclusionToggleBorder = (active: boolean) => active ? '1px solid var(--color-warning)' : '1px solid var(--color-gray-200)'
const fechaInput = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
const diasEntre = (desde: string, hasta: string) => {
    const [anioDesde, mesDesde, diaDesde] = desde.split('-').map(Number)
    const [anioHasta, mesHasta, diaHasta] = hasta.split('-').map(Number)
    return (Date.UTC(anioHasta, mesHasta - 1, diaHasta) - Date.UTC(anioDesde, mesDesde - 1, diaDesde)) / 86_400_000 + 1
}

export type SeccionReporte = 'dashboard' | 'pedidos' | 'produccion' | 'ventas' | 'costos' | 'desperdicio' | 'performance' | 'caja'

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
    incluirTodo: boolean
    onIncluirTodoChange: (val: boolean) => void
    onRefresh: () => void
    onExport: () => void
    onOpenSettings: () => void
}

const SECCIONES: { key: SeccionReporte; label: string; icon: string }[] = [
    { key: 'pedidos', label: 'Pedidos e insumos', icon: '📦' },
    { key: 'dashboard', label: 'Dashboard ERP', icon: '📊' },
    { key: 'produccion', label: 'Producción', icon: '🏭' },
    { key: 'ventas', label: 'Ventas ERP', icon: '💰' },
    { key: 'costos', label: 'Costos ERP', icon: '📉' },
    { key: 'desperdicio', label: 'Desperdicio', icon: '🗑️' },
    { key: 'performance', label: 'Performance', icon: '⚡' },
    { key: 'caja', label: 'Flujo de Caja', icon: '💸' },
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
    incluirTodo,
    onIncluirTodoChange,
    onRefresh,
    onExport,
    onOpenSettings
}: PeriodoSelectorProps) {

    // Helper states for individual selectors
    const [mesTemp, setMesTemp] = useState(rango.desde.getMonth() + 1)
    const [anioTemp, setAnioTemp] = useState(rango.desde.getFullYear())
    const [fechaDia, setFechaDia] = useState(fechaInput(rango.desde))
    const [fechaSemana, setFechaSemana] = useState(fechaInput(rango.desde))
    const [customDesde, setCustomDesde] = useState(fechaInput(rango.desde))
    const [customHasta, setCustomHasta] = useState(fechaInput(rango.hasta))
    const errorRango = customDesde && customHasta && customDesde > customHasta
        ? 'La fecha Desde debe ser anterior o igual a Hasta.'
        : activeSection === 'pedidos' && customDesde && customHasta && diasEntre(customDesde, customHasta) > 366
            ? 'Pedidos e insumos admite períodos de hasta 366 días.' : ''

    const cambiarGranularidad = (valor: GranularidadTemporal) => {
        if (valor === 'rango' && granularidad !== 'rango') {
            setCustomDesde(fechaInput(rango.desde))
            setCustomHasta(fechaInput(rango.hasta))
        }
        onGranularidadChange(valor)
    }

    // Automatically recalculate Rango when temps change
    useEffect(() => {
        if (granularidad === 'mes') {
            onRangoChange(getDateRange('mes', { mes: mesTemp, anio: anioTemp }))
        } else if (granularidad === 'dia') {
            onRangoChange(getDateRange('dia', { fecha: fechaDia }))
        } else if (granularidad === 'semana') {
            onRangoChange(getDateRange('semana', { fecha: fechaSemana })) // Re-using fecha as reference for week
        } else if (granularidad === 'rango') {
            if (customDesde && customHasta && !errorRango) {
                onRangoChange(getDateRange('rango', { rangoDesde: customDesde, rangoHasta: customHasta }))
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [granularidad, mesTemp, anioTemp, fechaDia, fechaSemana, customDesde, customHasta, activeSection, errorRango])

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
                    <Link href="/reportes/pedidos-local" className="btn btn-secondary btn-sm">Pedidos de local</Link>
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
                        onChange={e => cambiarGranularidad(e.target.value as GranularidadTemporal)}
                        style={{ width: 150 }}
                        disabled={loading}
                    >
                        <option value="dia">Por Día</option>
                        <option value="semana">Por Semana</option>
                        <option value="mes">Por Mes</option>
                        <option value="rango">Rango de fechas</option>
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

            {/* Sub-header row: Info and Simulation Mode */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: 'var(--space-4)',
                gap: 'var(--space-4)',
                flexWrap: 'wrap'
            }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', fontStyle: 'italic' }}>
                    Mostrando datos para: <strong>{rango.label}</strong>
                </div>

                {activeSection === 'pedidos' && granularidad !== 'rango' && <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => cambiarGranularidad('rango')} disabled={loading}>Elegir rango de fechas</button>}

                {activeSection !== 'pedidos' && <div style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)',
                    padding: 'var(--space-1) var(--space-3)',
                    backgroundColor: incluirTodo ? 'var(--color-warning-light)' : 'var(--color-gray-50)',
                    borderRadius: 'var(--radius-full)',
                    border: InclusionToggleBorder(incluirTodo),
                    transition: 'all var(--transition-fast)'
                }}>
                    <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-2)', 
                        cursor: 'pointer',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: incluirTodo ? 'var(--color-warning-dark)' : 'var(--color-gray-600)',
                        margin: 0,
                        userSelect: 'none'
                    }} title="Incluye pedidos pendientes/confirmados como si estuvieran entregados para análisis pre-operativo">
                        <input 
                            type="checkbox" 
                            checked={incluirTodo}
                            onChange={e => onIncluirTodoChange(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        🚀 MODO PRE-OPERATIVO
                    </label>
                </div>}
            </div>

            {granularidad === 'rango' && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <label>Desde{activeSection === 'pedidos' ? ' (Fecha Entrega)' : ''}<input type="date" className="form-input"
                    value={customDesde} onChange={e => setCustomDesde(e.target.value)} disabled={loading} /></label>
                <label>Hasta{activeSection === 'pedidos' ? ' (Fecha Entrega)' : ''}<input type="date" className="form-input"
                    value={customHasta} onChange={e => setCustomHasta(e.target.value)} disabled={loading} min={customDesde || undefined} /></label>
                {errorRango && <span role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{errorRango}</span>}
            </div>}

            <div style={{
                display: 'flex',
                gap: 'var(--space-1)',
                overflowX: 'auto',
                paddingBottom: 'var(--space-2)',
                borderBottom: '2px solid var(--color-gray-200)',
                marginBottom: 'var(--space-4)'
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
