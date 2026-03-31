// components/produccion/v2/sections/ProductionStats.tsx
'use client'

import React from 'react'
import { Lote } from '../types'

interface ProductionStatsProps {
    lotes: Lote[]
}

export const ProductionStats: React.FC<ProductionStatsProps> = ({ lotes }) => {
    const stats = {
        total: lotes.length,
        enCamara: lotes.filter((l) => l.estado === 'en_camara').length,
        distribuido: lotes.filter((l) => l.estado === 'distribuido').length,
        merma: lotes.filter((l) => l.estado === 'merma').length,
        totalPaquetes: lotes.reduce((acc, l) => acc + l.unidadesProducidas, 0),
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div className="card">
                <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Lotes Hoy</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{stats.total}</div>
                </div>
            </div>
            <div className="card">
                <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📦 Total Paquetes</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#27AE60' }}>{stats.totalPaquetes}</div>
                </div>
            </div>
            <div className="card">
                <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>❄️ En Cámara</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3498DB' }}>{stats.enCamara}</div>
                </div>
            </div>
            <div className="card">
                <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✅ Distribuidos</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2ECC71' }}>{stats.distribuido}</div>
                </div>
            </div>
            <div className="card">
                <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠️ Mermas</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E74C3C' }}>{stats.merma}</div>
                </div>
            </div>
        </div>
    )
}
