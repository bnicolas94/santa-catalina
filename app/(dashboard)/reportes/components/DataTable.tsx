'use client'

import React, { useState, useMemo } from 'react'

export interface DataTableColumn {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    format?: (value: any, row: any) => string | React.ReactNode
    sortable?: boolean
    width?: string
}

interface DataTableProps {
    columns: DataTableColumn[]
    data: any[]
    onRowClick?: (row: any) => void
    showTotals?: boolean
    totalColumns?: string[]    // keys de columnas a sumar
    maxHeight?: string
    emptyMessage?: string
    exportFilename?: string
}

export default function DataTable({
    columns,
    data,
    onRowClick,
    showTotals = false,
    totalColumns = [],
    maxHeight = '400px',
    emptyMessage = 'No hay datos disponibles.',
    exportFilename
}: DataTableProps) {
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    const sortedData = useMemo(() => {
        if (!sortKey) return data
        return [...data].sort((a, b) => {
            const va = a[sortKey]
            const vb = b[sortKey]
            if (va == null && vb == null) return 0
            if (va == null) return 1
            if (vb == null) return -1
            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDir === 'asc' ? va - vb : vb - va
            }
            const sa = String(va).toLowerCase()
            const sb = String(vb).toLowerCase()
            return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
        })
    }, [data, sortKey, sortDir])

    const totals = useMemo(() => {
        if (!showTotals || totalColumns.length === 0) return null
        const result: Record<string, number> = {}
        for (const key of totalColumns) {
            result[key] = data.reduce((acc, row) => acc + (Number(row[key]) || 0), 0)
        }
        return result
    }, [data, showTotals, totalColumns])

    function handleSort(key: string) {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir('desc')
        }
    }

    function handleExportCSV() {
        if (!exportFilename) return
        const headers = columns.map(c => c.label).join(',')
        const rows = data.map(row =>
            columns.map(c => {
                const val = row[c.key]
                return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? ''
            }).join(',')
        ).join('\n')
        const csv = headers + '\n' + rows
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${exportFilename}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (data.length === 0) {
        return <div className="empty-state" style={{ padding: 'var(--space-8)' }}><p>{emptyMessage}</p></div>
    }

    return (
        <div>
            {exportFilename && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleExportCSV}
                        style={{ fontSize: 'var(--text-xs)' }}
                    >
                        📥 CSV
                    </button>
                </div>
            )}
            <div className="table-container" style={{ maxHeight, overflowY: 'auto' }}>
                <table className="table">
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    style={{
                                        textAlign: col.align || 'left',
                                        cursor: col.sortable !== false ? 'pointer' : 'default',
                                        position: 'sticky',
                                        top: 0,
                                        backgroundColor: 'var(--color-gray-50)',
                                        zIndex: 1,
                                        width: col.width,
                                        userSelect: 'none'
                                    }}
                                    onClick={() => col.sortable !== false && handleSort(col.key)}
                                >
                                    {col.label}
                                    {sortKey === col.key && (
                                        <span style={{ marginLeft: 4, fontSize: '10px' }}>
                                            {sortDir === 'asc' ? '▲' : '▼'}
                                        </span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((row, i) => (
                            <tr
                                key={row.id || i}
                                onClick={() => onRowClick?.(row)}
                                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                            >
                                {columns.map(col => (
                                    <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                                        {col.format ? col.format(row[col.key], row) : row[col.key] ?? '—'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                    {totals && (
                        <tfoot>
                            <tr style={{ backgroundColor: 'var(--color-gray-50)', fontWeight: 700 }}>
                                {columns.map((col, i) => (
                                    <td key={col.key} style={{ textAlign: col.align || 'left', borderTop: '2px solid var(--color-gray-200)' }}>
                                        {i === 0 && !totalColumns.includes(col.key) ? 'TOTAL' : ''}
                                        {totalColumns.includes(col.key) && col.format
                                            ? col.format(totals[col.key], totals)
                                            : totalColumns.includes(col.key)
                                                ? totals[col.key]?.toLocaleString('es-AR')
                                                : i > 0 ? '' : undefined
                                        }
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    )
}
