import type { CajaLiquidacionUI, EmpleadoLiquidable } from './weeklyPayroll.types'

interface Props {
    fechaInicio: string
    fechaFin: string
    cajaId: string
    cajas: CajaLiquidacionUI[]
    loading: boolean
    empleadosExcluidos: EmpleadoLiquidable[]
    empleadosDeVacaciones: EmpleadoLiquidable[]
    onFechaInicioChange: (fecha: string) => void
    onFechaFinChange: (fecha: string) => void
    onCajaChange: (cajaId: string) => void
    onAplicarCajaATodos: () => void
    onCalcular: () => void
}

export function WeeklyPayrollControls(props: Props) {
    return <>
        <div className="filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Desde (Lunes)</label>
                <input type="date" className="form-input" value={props.fechaInicio} onChange={e => props.onFechaInicioChange(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Hasta (Domingo)</label>
                <input type="date" className="form-input" value={props.fechaFin} onChange={e => props.onFechaFinChange(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Caja predeterminada</label>
                <select className="form-select" value={props.cajaId} onChange={e => props.onCajaChange(e.target.value)}>
                    <option value="">Seleccionar caja…</option>
                    {props.cajas.map(caja => <option key={caja.tipo} value={caja.tipo}>
                        {caja.nombre || caja.tipo}{caja.ubicacion?.nombre ? ` · ${caja.ubicacion.nombre}` : ''}
                    </option>)}
                </select>
                <button type="button" className="btn btn-ghost" onClick={props.onAplicarCajaATodos} disabled={!props.cajaId} style={{ marginTop: '6px', padding: '4px 8px', fontSize: 'var(--text-xs)' }}>
                    Aplicar a todo el lote
                </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary btn-block" onClick={props.onCalcular} disabled={props.loading}>
                    {props.loading ? 'Calculando...' : '🔄 Calcular Sueldos'}
                </button>
            </div>
        </div>

        {props.empleadosExcluidos.length > 0 && <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--color-info-bg)', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            <span>ℹ️</span>
            <div style={{ color: 'var(--color-info)', fontWeight: 500 }}>
                <strong>{props.empleadosExcluidos.length} empleados</strong> ya tienen una liquidación finalizada en este periodo y fueron omitidos:
                <span style={{ marginLeft: 'var(--space-2)', fontWeight: 400, fontStyle: 'italic' }}>
                    {props.empleadosExcluidos.map(empleado => `${empleado.nombre} ${empleado.apellido || ''}`).join(', ')}
                </span>
            </div>
        </div>}

        {props.empleadosDeVacaciones.length > 0 && <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            <span>🏖️</span>
            <div style={{ color: '#166534', fontWeight: 500 }}>
                <strong>{props.empleadosDeVacaciones.length} {props.empleadosDeVacaciones.length === 1 ? 'empleada/o está' : 'empleadas/os están'} de vacaciones</strong> durante toda su semana laboral y no se incluirán en esta liquidación:
                <span style={{ marginLeft: 'var(--space-2)', fontWeight: 400, fontStyle: 'italic' }}>
                    {props.empleadosDeVacaciones.map(empleado => `${empleado.nombre} ${empleado.apellido || ''}`).join(', ')}
                </span>
            </div>
        </div>}
    </>
}
