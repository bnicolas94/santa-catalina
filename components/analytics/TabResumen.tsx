'use client'

import { Doughnut } from 'react-chartjs-2'
import type { AnalyticsData } from './analytics.types'
import styles from './analytics.module.css'

interface TabResumenProps {
    data: AnalyticsData
}

const palette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

const money = (value: number) => `$${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

export default function TabResumen({ data }: TabResumenProps) {
    const puntualidad = Math.max(0, 100 - data.asistencia.porcentajeTardanzas)
    const areaChartData = {
        labels: data.distribucion.area.map(area => area.nombre),
        datasets: [{ data: data.distribucion.area.map(area => area.cantidad), backgroundColor: palette, borderColor: '#ffffff', borderWidth: 3 }]
    }
    const puestoChartData = {
        labels: data.distribucion.puesto.map(puesto => puesto.nombre),
        datasets: [{ data: data.distribucion.puesto.map(puesto => puesto.cantidad), backgroundColor: palette.map((color, index) => palette[(index + 2) % palette.length]), borderColor: '#ffffff', borderWidth: 3 }]
    }
    const chartOptions = {
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: { usePointStyle: true, pointStyle: 'circle' as const, boxWidth: 7, padding: 14, font: { size: 10 } }
            }
        }
    }

    return (
        <div>
            <div className={styles.sectionIntro}>
                <div>
                    <h2>Panorama general</h2>
                    <p>Los indicadores esenciales del período, sin mezclar el detalle operativo.</p>
                </div>
                <span className={styles.sectionTag}>{data.stats.activos} personas activas</span>
            </div>

            <section className={styles.primaryGrid} aria-label="Indicadores principales">
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Dotación activa</span><span className={styles.metricIcon}>RH</span></div>
                    <div className={styles.metricValue}>{data.stats.activos}</div>
                    <div className={styles.metricHint}>{data.stats.total} legajos totales · {data.stats.nuevosMes} altas en el mes</div>
                </article>
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Inversión del período</span><span className={`${styles.metricIcon} ${styles.metricIconSuccess}`}>$</span></div>
                    <div className={`${styles.metricValue} ${styles.positive}`}>{money(data.nomina.total)}</div>
                    <div className={styles.metricHint}>Masa salarial neta consolidada</div>
                </article>
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Puntualidad</span><span className={`${styles.metricIcon} ${puntualidad < 85 ? styles.metricIconWarning : styles.metricIconSuccess}`}>OK</span></div>
                    <div className={`${styles.metricValue} ${puntualidad < 85 ? styles.warningText : styles.positive}`}>{puntualidad.toFixed(1)}%</div>
                    <div className={styles.metricHint}>{data.asistencia.tardanzas} tardanzas sobre {data.asistencia.totalEntradas} entradas</div>
                </article>
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Ausentismo</span><span className={`${styles.metricIcon} ${data.asistencia.porcentajeAusentismo > 10 ? styles.metricIconDanger : styles.metricIconWarning}`}>AU</span></div>
                    <div className={`${styles.metricValue} ${data.asistencia.porcentajeAusentismo > 10 ? styles.dangerText : styles.warningText}`}>{data.asistencia.porcentajeAusentismo.toFixed(1)}%</div>
                    <div className={styles.metricHint}>{data.asistencia.ausencias} de {data.asistencia.jornadasEsperadas} jornadas esperadas</div>
                </article>
            </section>

            <div className={styles.summaryLayout}>
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div><h3>Composición de la dotación</h3><p>Distribución actual por estructura organizativa.</p></div>
                        <span className={styles.panelBadge}>Estructura</span>
                    </div>
                    <div className={styles.distributionGrid}>
                        <div>
                            <div className={styles.metricLabel}>Por área</div>
                            <div className={styles.chartFrame}><Doughnut data={areaChartData} options={chartOptions} /></div>
                        </div>
                        <div>
                            <div className={styles.metricLabel}>Por puesto</div>
                            <div className={styles.chartFrame}><Doughnut data={puestoChartData} options={chartOptions} /></div>
                        </div>
                    </div>
                </section>

                <aside className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div><h3>Señales operativas</h3><p>Datos que conviene vigilar en el período.</p></div>
                        <span className={styles.panelBadge}>4 claves</span>
                    </div>
                    <div className={styles.signals}>
                        <div className={styles.signalRow}>
                            <span className={styles.signalIcon}>HE</span>
                            <div className={styles.signalCopy}><strong>Horas extras</strong><span>{data.nomina.totalHsExtras.toLocaleString('es-AR')} horas pagadas</span></div>
                            <span className={styles.signalValue}>{money(data.nomina.totalMontoHsExtras)}</span>
                        </div>
                        <div className={styles.signalRow}>
                            <span className={styles.signalIcon}>AU</span>
                            <div className={styles.signalCopy}><strong>Costo del ausentismo</strong><span>Impacto estimado del período</span></div>
                            <span className={`${styles.signalValue} ${styles.dangerText}`}>{money(data.asistencia.costoAusentismo)}</span>
                        </div>
                        <div className={styles.signalRow}>
                            <span className={styles.signalIcon}>AN</span>
                            <div className={styles.signalCopy}><strong>Antigüedad promedio</strong><span>Rango {data.estructura.antiguedadMinima}–{data.estructura.antiguedadMaxima} meses</span></div>
                            <span className={styles.signalValue}>{data.estructura.antiguedadPromedio} meses</span>
                        </div>
                        <div className={styles.signalRow}>
                            <span className={styles.signalIcon}>MV</span>
                            <div className={styles.signalCopy}><strong>Movimientos</strong><span>Altas y bajas del mes</span></div>
                            <span className={styles.signalValue}>+{data.stats.nuevosMes} / −{data.stats.bajasMes}</span>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    )
}
