'use client'

import React from 'react'

interface Ubicacion {
    id: string
    nombre: string
    tipo: string
}

interface PeriodoSelectorProps {
    mes: string
    anio: string
    ubicacionId: string
    activeTab: 'economico' | 'produccion'
    loading: boolean
    ubicaciones: Ubicacion[]
    anios: string[]
    onMesChange: (mes: string) => void
    onAnioChange: (anio: string) => void
    onUbicacionChange: (id: string) => void
    onTabChange: (tab: 'economico' | 'produccion') => void
    onRefresh: () => void
    onExport: () => void
}

export default function PeriodoSelector({ 
    mes, 
    anio, 
    ubicacionId,
    activeTab, 
    loading, 
    ubicaciones,
    anios,
    onMesChange, 
    onAnioChange, 
    onUbicacionChange,
    onTabChange,
    onRefresh,
    onExport 
}: PeriodoSelectorProps) {
    const meses = [
        { v: '1', l: 'Enero' }, { v: '2', l: 'Febrero' }, { v: '3', l: 'Marzo' },
        { v: '4', l: 'Abril' }, { v: '5', l: 'Mayo' }, { v: '6', l: 'Junio' },
        { v: '7', l: 'Julio' }, { v: '8', l: 'Agosto' }, { v: '9', l: 'Septiembre' },
        { v: '10', l: 'Octubre' }, { v: '11', l: 'Noviembre' }, { v: '12', l: 'Diciembre' }
    ]

    return (
        <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>📊 Reportes de Gestión</h1>
                    <div className="tabs" style={{ display: 'flex', backgroundColor: 'var(--color-gray-100)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
                        <button 
                            className={`btn btn-sm ${activeTab === 'economico' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => onTabChange('economico')}
                            style={{ borderRadius: 'var(--radius-md)', padding: '4px 12px' }}
                        >
                            💰 Económico
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'produccion' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => onTabChange('produccion')}
                            style={{ borderRadius: 'var(--radius-md)', padding: '4px 12px' }}
                        >
                            🏭 Producción
                        </button>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
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
                        value={mes} 
                        onChange={e => onMesChange(e.target.value)} 
                        style={{ width: 120 }}
                        disabled={loading}
                    >
                        {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
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
        </div>
    )
}
