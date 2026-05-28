'use client'

interface TabAsistenciaProps {
    data: any
    setSelectedEmpleado: (id: string) => void
    setActiveTab: (tab: string) => void
}

export default function TabAsistencia({ data, setSelectedEmpleado, setActiveTab }: TabAsistenciaProps) {
    const goToLegajo = (empleadoId: string) => {
        setSelectedEmpleado(empleadoId)
        setActiveTab('legajo')
    }

    return (
        <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Tardanzas</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.asistencia.porcentajeTardanzas > 15 ? 'var(--color-danger)' : 'inherit' }}>
                        {data.asistencia.porcentajeTardanzas.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{data.asistencia.tardanzas} en el período</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Ausentismo</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.asistencia.porcentajeAusentismo > 10 ? 'var(--color-danger)' : 'inherit' }}>
                        {data.asistencia.porcentajeAusentismo.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{data.asistencia.ausencias} ausencias</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #dc2626' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Costo del Ausentismo</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: 'var(--color-danger)' }}>
                        ${data.asistencia.costoAusentismo.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Impacto estimado en pesos</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #7c3aed' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Sanciones del Período</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)' }}>{data.asistencia.sancionesCount}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Apercibimientos y suspensiones</div>
                </div>
            </div>

            {/* Ranking de Puntualidad */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>🏆 Mejores en Puntualidad</h3>
                    {(data.asistencia.rankingMejores || []).length === 0 ? (
                        <div style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: 'var(--space-6)' }}>Sin datos de puntualidad</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {data.asistencia.rankingMejores.map((item: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-100)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-gray-300)', width: '24px' }}>{idx + 1}</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.nombre}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{item.puntuales}/{item.entradas} puntuales</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <span className="badge badge-success" style={{ fontSize: '11px' }}>{item.porcentaje}%</span>
                                        <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '9px' }} onClick={() => goToLegajo(item.empleadoId)}>Ver</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>⚠️ Necesitan Mejorar</h3>
                    {(data.asistencia.rankingPeores || []).length === 0 ? (
                        <div style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: 'var(--space-6)' }}>Sin datos de puntualidad</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {data.asistencia.rankingPeores.map((item: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-100)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-gray-300)', width: '24px' }}>{idx + 1}</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.nombre}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{item.puntuales}/{item.entradas} puntuales</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <span className="badge badge-danger" style={{ fontSize: '11px' }}>{item.porcentaje}%</span>
                                        <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '9px' }} onClick={() => goToLegajo(item.empleadoId)}>Ver</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detalle de Tardanzas */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>🕒 Detalle de Tardanzas en el Periodo</h3>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Fecha</th>
                                <th style={{ textAlign: 'center' }}>Entrada Esperada</th>
                                <th style={{ textAlign: 'center' }}>Fichada</th>
                                <th style={{ textAlign: 'center' }}>Retraso</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.asistencia.detalleTardanzas.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay tardanzas registradas en este periodo.
                                    </td>
                                </tr>
                            ) : (
                                data.asistencia.detalleTardanzas.map((t: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 600 }}>{t.empleadoNombre}</td>
                                        <td>{new Date(t.fecha).toLocaleDateString()}</td>
                                        <td style={{ textAlign: 'center' }}>{t.horaEsperada} hs</td>
                                        <td style={{ textAlign: 'center', color: 'var(--color-danger)', fontWeight: 600 }}>{t.horaFichada} hs</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-danger" style={{ fontSize: '11px' }}>{t.minutosRetraso} min</span>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => goToLegajo(t.empleadoId)}>
                                                Ir al Legajo
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
