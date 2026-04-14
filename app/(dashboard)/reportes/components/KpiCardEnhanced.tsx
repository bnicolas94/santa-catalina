'use client'

import React from 'react'

interface KpiCardEnhancedProps {
    label: string
    value: string | number
    footer?: string
    color?: string
    loading?: boolean
    delta?: {
        text: string
        color: string
        arrow: string
    }
    previousLabel?: string
    previousValue?: string
    icon?: string
    onClick?: () => void
}

export default function KpiCardEnhanced({
    label,
    value,
    footer,
    color = 'var(--color-primary)',
    loading = false,
    delta,
    previousLabel,
    previousValue,
    icon,
    onClick
}: KpiCardEnhancedProps) {
    return (
        <div
            className="card"
            onClick={onClick}
            style={{
                padding: 'var(--space-5) var(--space-6)',
                textAlign: 'center',
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all var(--transition-fast)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {loading ? (
                <div className="spinner" style={{ margin: '0 auto', width: 20, height: 20 }} />
            ) : (
                <>
                    {/* Label */}
                    <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-gray-500)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)'
                    }}>
                        {icon && <span style={{ fontSize: 'var(--text-sm)' }}>{icon}</span>}
                        {label}
                    </div>

                    {/* Value */}
                    <div style={{
                        fontSize: 'var(--text-2xl)',
                        fontFamily: 'var(--font-heading)',
                        color: color,
                        lineHeight: 1.2,
                        marginBottom: delta ? 'var(--space-2)' : 0
                    }}>
                        {value}
                    </div>

                    {/* Delta vs periodo anterior */}
                    {delta && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--space-1)',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-ui)',
                            fontWeight: 600,
                            color: delta.color
                        }}>
                            <span>{delta.arrow}</span>
                            <span>{delta.text}</span>
                            {previousLabel && (
                                <span style={{ color: 'var(--color-gray-400)', fontWeight: 400, marginLeft: 'var(--space-1)' }}>
                                    vs {previousLabel}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Previous value tooltip */}
                    {previousValue && !delta && (
                        <div style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-gray-400)',
                            marginTop: 'var(--space-1)',
                            fontFamily: 'var(--font-ui)'
                        }}>
                            Anterior: {previousValue}
                        </div>
                    )}

                    {/* Footer */}
                    {footer && (
                        <div style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-gray-400)',
                            marginTop: 'var(--space-1)',
                            fontFamily: 'var(--font-ui)'
                        }}>
                            {footer}
                        </div>
                    )}

                    {/* Accent bar at top */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        backgroundColor: color,
                        opacity: 0.8
                    }} />
                </>
            )}
        </div>
    )
}
