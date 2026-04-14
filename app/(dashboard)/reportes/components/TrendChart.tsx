'use client'

import React from 'react'
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    LineElement, PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { CHART_COLORS, getChartColor } from '../utils/formatters'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

interface TrendChartProps {
    title?: string
    labels: string[]
    datasets: {
        label: string
        data: number[]
        color?: string
        type?: 'bar' | 'line'
        fill?: boolean
    }[]
    height?: number
    type?: 'bar' | 'line'
    stacked?: boolean
    showLegend?: boolean
    beginAtZero?: boolean
    formatTooltip?: (value: number) => string
}

export default function TrendChart({
    title,
    labels,
    datasets,
    height = 300,
    type = 'bar',
    stacked = false,
    showLegend = true,
    beginAtZero = true,
    formatTooltip
}: TrendChartProps) {
    const chartDatasets = datasets.map((ds, i) => {
        const color = ds.color || getChartColor(i)
        const isLine = (ds.type || type) === 'line'
        return {
            label: ds.label,
            data: ds.data,
            backgroundColor: isLine
                ? (ds.fill ? color + '33' : 'transparent')
                : color,
            borderColor: isLine ? color : undefined,
            borderWidth: isLine ? 2 : 0,
            borderRadius: isLine ? 0 : 4,
            pointRadius: isLine ? 3 : 0,
            pointBackgroundColor: isLine ? color : undefined,
            fill: ds.fill || false,
            tension: isLine ? 0.3 : 0,
            type: ds.type as any
        }
    })

    const chartData = { labels, datasets: chartDatasets }

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false
        },
        scales: {
            x: {
                stacked,
                grid: { display: false },
                ticks: { font: { size: 11 } }
            },
            y: {
                stacked,
                beginAtZero,
                grid: { color: '#f0f0f0' },
                ticks: {
                    font: { size: 11 },
                    callback: formatTooltip
                }
            }
        },
        plugins: {
            legend: {
                display: showLegend && datasets.length > 1,
                position: 'bottom' as const,
                labels: { boxWidth: 12, font: { size: 11 }, padding: 16 }
            },
            tooltip: {
                callbacks: formatTooltip ? {
                    label: (ctx: any) => `${ctx.dataset.label}: ${formatTooltip(ctx.parsed.y)}`
                } : undefined
            }
        }
    }

    const ChartComponent = type === 'line' ? Line : Bar

    return (
        <div>
            {title && (
                <h3 style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-gray-600)',
                    marginBottom: 'var(--space-4)',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.03em'
                }}>
                    {title}
                </h3>
            )}
            <div style={{ height }}>
                <ChartComponent data={chartData} options={options} />
            </div>
        </div>
    )
}
