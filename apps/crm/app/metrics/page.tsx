'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import styles from './metrics.module.css'

type MetricsReport = {
  period: { days: number; from: string; to: string }
  generatedAt: string
  received: {
    today: number
    total: number
    dailyAverage: number
    daily: Array<{ day: string; conversations: number }>
  }
  operators: Array<{ agentId: string; name: string; conversations: number; messages: number }>
  answeredConversations: number
  queue: { unassigned: number; open: number; waitingCustomer: number }
  resolved: number
  scheduledOrders: { total: number; paid: number }
  complaints: { total: number; mode: 'MANUAL_TAG' | 'PENDING_AI' }
}

const PERIODS = [7, 14, 30, 90]

function shortDay(value: string) {
  const date = new Date(`${value}T12:00:00-03:00`)
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric' }).format(date).replace('.', '')
}

function longDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00-03:00`))
}

async function metricsApi(days: number) {
  const response = await fetch(`/api/admin/metrics?days=${days}`, {
    cache: 'no-store',
    headers: { 'x-crm-demo-agent': 'admin' },
  })
  const body = await response.json().catch(() => ({})) as MetricsReport & { error?: string }
  if (!response.ok) throw new Error(body.error || 'No se pudieron consultar las métricas.')
  return body
}

export default function MetricsPage() {
  const [days, setDays] = useState(7)
  const [report, setReport] = useState<MetricsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    metricsApi(days)
      .then(result => { if (!cancelled) { setReport(result); setError(null) } })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudieron consultar las métricas.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days, reloadKey])

  const maxDaily = useMemo(() => Math.max(1, ...(report?.received.daily.map(item => item.conversations) || [])), [report])
  const maxOperator = useMemo(() => Math.max(1, ...(report?.operators.map(item => item.conversations) || [])), [report])
  const scheduledPaidPercent = report?.scheduledOrders.total
    ? Math.round(report.scheduledOrders.paid / report.scheduledOrders.total * 100)
    : 0

  return <main className={styles.page}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/" aria-label="Santa Catalina Atención">SC</Link>
      <nav>
        <Link href="/"><span>▣</span><b>Conversaciones</b></Link>
        <Link className={styles.activeLink} href="/metrics"><span>▥</span><b>Métricas</b></Link>
        <Link href="/settings"><span>⚙</span><b>Canales</b></Link>
      </nav>
      <div className={styles.adminOnly}><i>◆</i><span><b>Sólo administradores</b><small>Información operativa protegida</small></span></div>
    </aside>

    <section className={styles.content}>
      <header className={styles.header}>
        <div><span>Centro de rendimiento</span><h1>Métricas de Atención</h1><p>Una lectura clara del volumen de clientes y el trabajo del equipo.</p></div>
        <div className={styles.periodPicker} aria-label="Período de las métricas">
          {PERIODS.map(option => <button key={option} className={days === option ? styles.periodActive : ''} onClick={() => { setLoading(true); setDays(option) }}>{option} días</button>)}
        </div>
      </header>

      {error && <div className={styles.error}><strong>No pudimos mostrar las métricas</strong><span>{error}</span><button onClick={() => { setLoading(true); setReloadKey(current => current + 1) }}>Reintentar</button></div>}
      {loading && !report && <div className={styles.loading}><span /><strong>Calculando conversaciones y actividad…</strong></div>}

      {report && <>
        <section className={styles.kpis}>
          <article className={styles.criticalCard}><div><span className={styles.kpiIcon}>↙</span><b>Conversaciones recibidas hoy</b></div><strong>{report.received.today}</strong><p>Personas distintas que escribieron hoy</p><small>Cada conversación cuenta una sola vez, aunque envíe varios mensajes.</small></article>
          <article><div><span className={styles.kpiIcon}>◫</span><b>Recibidas en {report.period.days} días</b></div><strong>{report.received.total}</strong><p>Promedio de {report.received.dailyAverage} por día</p><small>Suma de conversaciones únicas de cada jornada.</small></article>
          <article><div><span className={styles.kpiIcon}>✓</span><b>Respondidas desde el CRM</b></div><strong>{report.answeredConversations}</strong><p>Conversaciones con respuesta del equipo</p><small>No atribuye mensajes enviados sólo desde el teléfono.</small></article>
          <article className={styles.complaintCard}><div><span className={styles.kpiIcon}>!</span><b>Quejas y reclamos</b></div>{report.complaints.mode === 'MANUAL_TAG' ? <><strong>{report.complaints.total}</strong><p>Conversaciones etiquetadas en el período</p></> : <><strong className={styles.pendingValue}>Próximamente</strong><p>Clasificación automática con IA</p></>}<small>{report.complaints.mode === 'MANUAL_TAG' ? 'La IA podrá complementar esta clasificación.' : 'El espacio ya está reservado sin inventar datos.'}</small></article>
        </section>

        <section className={styles.dashboardGrid}>
          <article className={styles.dailyCard}>
            <header><div><span>Dato principal</span><h2>Conversaciones recibidas por día</h2><p>No son mensajes: son personas distintas que iniciaron contacto cada jornada.</p></div><div className={styles.dateRange}><b>{longDate(report.period.from)}</b><span>al {longDate(report.period.to)}</span></div></header>
            <div className={styles.barChart}>
              {report.received.daily.map(item => <div className={styles.barColumn} key={item.day} title={`${item.conversations} conversaciones el ${longDate(item.day)}`}><span>{item.conversations}</span><div><i style={{ height: `${Math.max(item.conversations ? 8 : 2, item.conversations / maxDaily * 100)}%` }} /></div><small>{shortDay(item.day)}</small></div>)}
            </div>
            <footer><span>● Conversaciones entrantes únicas por día</span><small>Actualizado {new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(report.generatedAt))}</small></footer>
          </article>

          <article className={styles.queueCard}>
            <header><span>Estado actual</span><h2>Bandeja ahora</h2></header>
            <div className={styles.queueRows}>
              <div><span className={styles.queueNew}>N</span><p><b>Sin asignar</b><small>Esperan un operador</small></p><strong>{report.queue.unassigned}</strong></div>
              <div><span className={styles.queueOpen}>A</span><p><b>Abiertas</b><small>En atención</small></p><strong>{report.queue.open}</strong></div>
              <div><span className={styles.queueWaiting}>E</span><p><b>En espera</b><small>Esperan al cliente</small></p><strong>{report.queue.waitingCustomer}</strong></div>
            </div>
            <div className={styles.queueTotal}><span>Conversaciones activas</span><strong>{report.queue.unassigned + report.queue.open + report.queue.waitingCustomer}</strong></div>
          </article>

          <article className={styles.operatorCard}>
            <header><div><span>Equipo</span><h2>Conversaciones por operador</h2><p>Conversaciones distintas respondidas desde el CRM durante el período.</p></div></header>
            <div className={styles.operatorList}>
              {report.operators.length === 0 && <p className={styles.empty}>Todavía no hay respuestas de operadores en este período.</p>}
              {report.operators.map((operator, index) => <div className={styles.operatorRow} key={operator.agentId}><span className={styles.rank}>{index + 1}</span><span className={styles.operatorAvatar}>{operator.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span><div><span><b>{operator.name}</b><strong>{operator.conversations} conversaciones</strong></span><div><i style={{ width: `${operator.conversations / maxOperator * 100}%` }} /></div><small>{operator.messages} mensajes enviados</small></div></div>)}
            </div>
            <footer>Una conversación atendida por dos operadores puede aparecer una vez para cada uno.</footer>
          </article>

          <article className={styles.operationsCard}>
            <header><span>Resultado operativo</span><h2>Resolución y pedidos</h2></header>
            <div className={styles.operationMetric}><span className={styles.operationIcon}>✓</span><div><b>Conversaciones resueltas</b><small>Marcadas como resueltas en el período</small></div><strong>{report.resolved}</strong></div>
            <div className={styles.operationMetric}><span className={styles.operationIcon}>▤</span><div><b>Pedidos agendados</b><small>Pasados al historial de Atención</small></div><strong>{report.scheduledOrders.total}</strong></div>
            <div className={styles.paidProgress}><div><span>Marcados como pagados</span><b>{report.scheduledOrders.paid} · {scheduledPaidPercent}%</b></div><span><i style={{ width: `${scheduledPaidPercent}%` }} /></span></div>
          </article>
        </section>

        <aside className={styles.definition}><span>i</span><p><b>Cómo se calcula el dato crítico:</b> dentro de cada día de Argentina se cuenta una sola vez cada conversación que recibió al menos un mensaje del cliente. Si esa persona escribe diez veces durante el día, sigue contando como una.</p></aside>
      </>}
    </section>
  </main>
}
