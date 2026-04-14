'use client'

import React from 'react'

export interface Alerta {
    id: string
    tipo: 'warning' | 'danger' | 'info' | 'success'
    titulo: string
    mensaje: string
    accion?: string
}

interface AlertBannerProps {
    alertas: Alerta[]
    onDismiss?: (id: string) => void
}

const ICONS: Record<string, string> = {
    warning: '⚠️',
    danger: '🚨',
    info: 'ℹ️',
    success: '✅'
}

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
    warning: {
        bg: 'var(--color-warning-bg)',
        border: 'var(--color-warning)',
        text: '#92400E'
    },
    danger: {
        bg: 'var(--color-danger-bg)',
        border: 'var(--color-danger)',
        text: '#991B1B'
    },
    info: {
        bg: 'var(--color-info-bg)',
        border: 'var(--color-info)',
        text: '#1E40AF'
    },
    success: {
        bg: 'var(--color-success-bg)',
        border: 'var(--color-success)',
        text: '#065F46'
    }
}

export default function AlertBanner({ alertas, onDismiss }: AlertBannerProps) {
    if (!alertas || alertas.length === 0) return null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {alertas.map(alerta => {
                const colors = COLORS[alerta.tipo] || COLORS.info
                return (
                    <div
                        key={alerta.id}
                        className="fade-in"
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--space-3)',
                            padding: 'var(--space-4) var(--space-5)',
                            backgroundColor: colors.bg,
                            borderLeft: `4px solid ${colors.border}`,
                            borderRadius: 'var(--radius-md)',
                            color: colors.text,
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--text-sm)'
                        }}
                    >
                        <span style={{ fontSize: 'var(--text-lg)', lineHeight: 1, flexShrink: 0 }}>
                            {ICONS[alerta.tipo]}
                        </span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                                {alerta.titulo}
                            </div>
                            <div style={{ opacity: 0.9 }}>{alerta.mensaje}</div>
                            {alerta.accion && (
                                <div style={{ marginTop: 'var(--space-2)', fontStyle: 'italic', opacity: 0.7 }}>
                                    💡 {alerta.accion}
                                </div>
                            )}
                        </div>
                        {onDismiss && (
                            <button
                                onClick={() => onDismiss(alerta.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: colors.text,
                                    opacity: 0.5,
                                    fontSize: 'var(--text-lg)',
                                    lineHeight: 1,
                                    padding: 0
                                }}
                            >
                                ×
                            </button>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
