'use client'

import React from 'react'

interface KpiCardProps {
    label: string
    value: string | number
    footer?: string
    color?: string
    loading?: boolean
}

export default function KpiCard({ label, value, footer, color = 'var(--color-primary)', loading = false }: KpiCardProps) {
    return (
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', minHeight: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {loading ? (
                <div className="spinner-sm" style={{ margin: '0 auto' }} />
            ) : (
                <>
                    <div style={{ 
                        fontSize: 'var(--text-xs)', 
                        color: 'var(--color-gray-500)', 
                        textTransform: 'uppercase', 
                        fontWeight: 700, 
                        marginBottom: 'var(--space-2)' 
                    }}>
                        {label}
                    </div>
                    <div style={{ 
                        fontSize: 'var(--text-2xl)', 
                        fontFamily: 'var(--font-heading)', 
                        color: color,
                        lineHeight: 1.2
                    }}>
                        {value}
                    </div>
                    {footer && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)', marginTop: 'var(--space-1)' }}>
                            {footer}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
