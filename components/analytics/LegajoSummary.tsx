import type { AnalyticsHistorico } from './analytics.types'

export function LegajoSummary({ historico }: { historico: AnalyticsHistorico }) {
    const { empleado, kpis } = historico
    const indicadores = [
        { label: 'Neto acumulado', value: `$${kpis.totalNeto.toLocaleString()}`, detail: `${kpis.cantidadLiquidaciones} liquidaciones`, color: 'var(--color-success)' },
        { label: 'Promedio liquidación', value: `$${kpis.promedioNetoPorLiquidacion.toLocaleString()}`, detail: 'Por período', color: 'var(--color-gray-900)' },
        { label: 'Horas extra', value: `${kpis.totalHsExtras} h`, detail: `$${kpis.totalMontoHsExtras.toLocaleString()}`, color: 'var(--color-warning)' },
        { label: 'Puntualidad', value: `${kpis.puntualidad}%`, detail: `${kpis.totalDiasTrabajados} días trabajados`, color: kpis.puntualidad >= 90 ? 'var(--color-success)' : 'var(--color-warning)' },
        { label: 'Ausencias', value: String(kpis.totalDiasAusentes), detail: `${kpis.totalDiasJustificados} justificadas`, color: kpis.totalDiasAusentes ? 'var(--color-danger)' : 'var(--color-gray-900)' },
        { label: 'Deuda préstamos', value: `$${kpis.deudaPendiente.toLocaleString()}`, detail: `${kpis.sanciones} sanciones`, color: kpis.deudaPendiente ? 'var(--color-danger)' : 'var(--color-gray-900)' },
    ]

    return <>
        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)', background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)' }}>
            <div><span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Legajo individual</span><h2 style={{ margin: '5px 0 3px', fontSize: 'var(--text-xl)' }}>{empleado.nombre} {empleado.apellido || ''}</h2><div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>{empleado.rol || 'Sin rol'} · {empleado.diasTrabajoSemana || 'Jornada no configurada'}</div></div>
            <span className={`badge ${empleado.activo === false ? 'badge-danger' : 'badge-success'}`}>{empleado.activo === false ? 'Inactivo' : 'Activo'}</span>
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {indicadores.map(indicador => <div key={indicador.label} className="card" style={{ padding: 'var(--space-4)', border: '1px solid var(--color-gray-200)' }}><div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>{indicador.label}</div><div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: indicador.color, marginTop: '5px' }}>{indicador.value}</div><div style={{ fontSize: '10px', color: 'var(--color-gray-400)', marginTop: '2px' }}>{indicador.detail}</div></div>)}
        </section>
    </>
}
