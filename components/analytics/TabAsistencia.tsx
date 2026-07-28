'use client'

import type { AnalyticsData, AnalyticsRanking } from './analytics.types'
import styles from './analytics.module.css'

interface TabAsistenciaProps {
    data: AnalyticsData
    setSelectedEmpleado: (id: string) => void
    setActiveTab: (tab: string) => void
}

interface RankingPanelProps {
    title: string
    description: string
    badge: string
    items: AnalyticsRanking[]
    risk?: boolean
    onSelect: (id: string) => void
}

const money = (value: number) => `$${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

function RankingPanel({ title, description, badge, items, risk = false, onSelect }: RankingPanelProps) {
    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <div><h3>{title}</h3><p>{description}</p></div>
                <span className={styles.panelBadge}>{badge}</span>
            </div>
            {items.length === 0 ? (
                <div className={styles.emptyState}>Todavía no hay suficientes entradas evaluables.</div>
            ) : (
                <div className={styles.rankingList}>
                    {items.map((item, index) => (
                        <div className={styles.rankingItem} key={item.empleadoId}>
                            <span className={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</span>
                            <div>
                                <div className={styles.rankingName}>{item.nombre}</div>
                                <div className={styles.rankingMeta}>{item.puntuales} de {item.entradas} entradas puntuales</div>
                            </div>
                            <div className={styles.rankingAction}>
                                <span className={`${styles.score} ${risk ? styles.scoreRisk : ''}`}>{item.porcentaje}%</span>
                                <button className={styles.linkButton} onClick={() => onSelect(item.empleadoId)}>Legajo</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

export default function TabAsistencia({ data, setSelectedEmpleado, setActiveTab }: TabAsistenciaProps) {
    const puntualidad = Math.max(0, 100 - data.asistencia.porcentajeTardanzas)
    const goToLegajo = (empleadoId: string) => {
        setSelectedEmpleado(empleadoId)
        setActiveTab('legajo')
    }

    return (
        <div>
            <div className={styles.sectionIntro}>
                <div>
                    <h2>Asistencia y puntualidad</h2>
                    <p>Primero las excepciones que requieren acción; después, el detalle de cada fichada.</p>
                </div>
                <span className={styles.sectionTag}>{data.asistencia.totalEntradas} entradas evaluadas</span>
            </div>

            <section className={styles.primaryGrid} aria-label="Indicadores de asistencia">
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Puntualidad</span><span className={`${styles.metricIcon} ${puntualidad < 85 ? styles.metricIconWarning : styles.metricIconSuccess}`}>OK</span></div>
                    <div className={`${styles.metricValue} ${puntualidad < 85 ? styles.warningText : styles.positive}`}>{puntualidad.toFixed(1)}%</div>
                    <div className={styles.metricHint}>Entradas dentro del horario y la tolerancia</div>
                </article>
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Ausentismo</span><span className={`${styles.metricIcon} ${data.asistencia.porcentajeAusentismo > 10 ? styles.metricIconDanger : styles.metricIconWarning}`}>AU</span></div>
                    <div className={`${styles.metricValue} ${data.asistencia.porcentajeAusentismo > 10 ? styles.dangerText : styles.warningText}`}>{data.asistencia.porcentajeAusentismo.toFixed(1)}%</div>
                    <div className={styles.metricHint}>{data.asistencia.ausencias} ausencias sobre {data.asistencia.jornadasEsperadas} jornadas</div>
                </article>
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Costo de ausencias</span><span className={`${styles.metricIcon} ${styles.metricIconDanger}`}>$</span></div>
                    <div className={`${styles.metricValue} ${styles.dangerText}`}>{money(data.asistencia.costoAusentismo)}</div>
                    <div className={styles.metricHint}>Impacto estimado según el valor diario individual</div>
                </article>
                <article className={styles.metricCard}>
                    <div className={styles.metricTop}><span className={styles.metricLabel}>Sanciones</span><span className={styles.metricIcon}>SA</span></div>
                    <div className={styles.metricValue}>{data.asistencia.sancionesCount}</div>
                    <div className={styles.metricHint}>Apercibimientos y suspensiones del período</div>
                </article>
            </section>

            <div className={styles.summaryStrip} aria-label="Resumen operativo de asistencia">
                <div className={styles.summaryItem}><span>Entradas evaluables</span><strong>{data.asistencia.totalEntradas}</strong></div>
                <div className={styles.summaryItem}><span>Tardanzas detectadas</span><strong className={data.asistencia.tardanzas > 0 ? styles.warningText : styles.positive}>{data.asistencia.tardanzas}</strong></div>
                <div className={styles.summaryItem}><span>Jornadas esperadas</span><strong>{data.asistencia.jornadasEsperadas}</strong></div>
            </div>

            <div className={styles.rankingGrid}>
                <RankingPanel title="Requieren atención" description="Menor índice de puntualidad en el período." badge="Prioridad" items={data.asistencia.rankingPeores || []} risk onSelect={goToLegajo} />
                <RankingPanel title="Mejor puntualidad" description="Personas con mayor consistencia horaria." badge="Reconocer" items={data.asistencia.rankingMejores || []} onSelect={goToLegajo} />
            </div>

            <section className={styles.detailPanel}>
                <div className={styles.panelHeader}>
                    <div><h3>Detalle de tardanzas</h3><p>Registro cronológico para revisar casos concretos.</p></div>
                    <span className={styles.panelBadge}>{data.asistencia.detalleTardanzas.length} registros</span>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Fecha</th>
                                <th style={{ textAlign: 'center' }}>Horario esperado</th>
                                <th style={{ textAlign: 'center' }}>Entrada real</th>
                                <th style={{ textAlign: 'center' }}>Demora</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.asistencia.detalleTardanzas.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>No se registraron tardanzas en este período.</td></tr>
                            ) : data.asistencia.detalleTardanzas.map((tardanza, index) => (
                                <tr key={`${tardanza.empleadoId}-${tardanza.fecha}-${index}`}>
                                    <td style={{ fontWeight: 650 }}>{tardanza.empleadoNombre}</td>
                                    <td>{new Date(tardanza.fecha).toLocaleDateString('es-AR')}</td>
                                    <td style={{ textAlign: 'center' }}>{tardanza.horaEsperada} hs</td>
                                    <td style={{ textAlign: 'center', fontWeight: 650 }}>{tardanza.horaFichada} hs</td>
                                    <td style={{ textAlign: 'center' }}><span className="badge badge-danger" style={{ fontSize: '10px' }}>{tardanza.minutosRetraso} min</span></td>
                                    <td><button className={styles.linkButton} onClick={() => goToLegajo(tardanza.empleadoId)}>Ver legajo</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
