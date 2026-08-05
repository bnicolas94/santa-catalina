import type { DiaLiquidacionUI } from './weeklyPayroll.types'
import { toTimeInputValue } from './weeklyPayroll.utils'

interface Props {
    dia: DiaLiquidacionUI
    empleadoId: string
    actualizandoEstado: boolean
    estado: string
    onTimeChange: (empleadoId: string, fecha: string, campo: 'entrada' | 'salida', valor: string) => void
    onHoursChange: (empleadoId: string, fecha: string, valor: string) => void
    onJustificar: (empleadoId: string, fecha: string) => void
    onQuitarJustificacion: (empleadoId: string, fecha: string) => void
    onStatusChange: (empleadoId: string, fecha: string, estado: string) => void
}

export function WeeklyPayrollDayCard(props: Props) {
    const { dia, empleadoId } = props
    const esVacaciones = dia.tipoInasistencia === 'VACACIONES'
    const esLicenciaPaga = dia.tipoInasistencia === 'JUSTIFICADA_PAGA'
    return <div style={{ backgroundColor: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: `1px solid ${dia.esFeriado ? 'var(--color-warning)' : 'var(--color-gray-200)'}`, fontSize: '11px', opacity: dia.horasTrabajadas > 0 || dia.multiplicadorJornal > 0 || esLicenciaPaga ? 1 : 0.5 }}>
        <div style={{ fontWeight: 700, borderBottom: '1px solid var(--color-gray-100)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{dia.diaSemana} {dia.fecha.split('-')[2]}</span>
            {dia.esFeriado && <span style={{ color: 'var(--color-warning)' }}>🚩</span>}
            {dia.esJustificado && !dia.tipoInasistencia && <span className="badge badge-success" style={{ fontSize: '8px', padding: '1px 3px' }}>MANUAL</span>}
            {dia.tipoInasistencia && <span className={`badge badge-${dia.tipoInasistencia.includes('INJUSTIFICADA') ? 'danger' : 'info'}`} style={{ fontSize: '7px', padding: '1px 3px' }}>
                {dia.tipoInasistencia.replace(/_/g, ' ')}
            </span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <input type="time" disabled={esVacaciones} className="form-input" style={{ width: '52px', padding: '0px 1px', fontSize: '9px', height: '18px', textAlign: 'center', border: '1px solid var(--color-gray-200)', borderRadius: '2px' }} value={toTimeInputValue(dia.entrada)} onChange={e => props.onTimeChange(empleadoId, dia.fecha, 'entrada', e.target.value)} title="Hora de entrada" />
                    <span style={{ fontSize: '9px', color: 'var(--color-gray-400)' }}>a</span>
                    <input type="time" disabled={esVacaciones} className="form-input" style={{ width: '52px', padding: '0px 1px', fontSize: '9px', height: '18px', textAlign: 'center', border: '1px solid var(--color-gray-200)', borderRadius: '2px' }} value={toTimeInputValue(dia.salida)} onChange={e => props.onTimeChange(empleadoId, dia.fecha, 'salida', e.target.value)} title="Hora de salida" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', gap: '3px' }}>Hs reales:
                        <input type="number" disabled={esVacaciones} min="0" max="24" step="0.25" className="form-input" style={{ width: '54px', padding: '0 4px', fontSize: '10px', height: '22px', textAlign: 'center', fontWeight: 700 }} value={dia.horasTrabajadas} onChange={e => props.onHoursChange(empleadoId, dia.fecha, e.target.value)} title="Editar horas reales; recalcula automáticamente el jornal del día" />
                    </label>
                    {dia.horasExtras > 0 && <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>+{dia.horasExtras} h extra</span>}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {!esVacaciones && dia.horasTrabajadas === 0 && <button className="btn btn-ghost" title="Justificar día completo" onClick={() => props.onJustificar(empleadoId, dia.fecha)} style={{ padding: '2px', height: 'auto', fontSize: '14px', color: 'var(--color-success)' }}>🟢</button>}
                {!esVacaciones && dia.esJustificado && <button className="btn btn-ghost" title="Quitar justificación" onClick={() => props.onQuitarJustificacion(empleadoId, dia.fecha)} style={{ padding: '2px', height: 'auto', fontSize: '14px', color: 'var(--color-danger)' }}>🔴</button>}
            </div>
        </div>
        <div style={{ marginTop: '4px', borderTop: '1px dashed var(--color-gray-200)', paddingTop: '4px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: 'var(--color-gray-400)' }}>Estado:</span>
                {props.actualizandoEstado ? <span style={{ fontSize: '8px', color: 'var(--color-gray-400)' }}>Guardando...</span> : <select disabled={esVacaciones} value={props.estado} onChange={e => props.onStatusChange(empleadoId, dia.fecha, e.target.value)} className="form-select" style={{ padding: '0px 2px', fontSize: '9px', height: '16px', width: '88px', border: '1px solid var(--color-gray-200)', borderRadius: '2px', cursor: esVacaciones ? 'default' : 'pointer' }}>
                    <option value="TRABAJO">🟢 Trabajó</option><option value="VACACIONES">🏖️ Vacaciones</option><option value="FRANCO">⚪ Franco</option><option value="FERIADO">🚩 Feriado</option><option value="ENFERMEDAD">🟣 Enfermedad</option><option value="SIN_AVISO">🔴 Sin Aviso</option><option value="CON_AVISO">🟠 Con Aviso</option>
                </select>}
            </div>
        </div>
        <div style={{ fontWeight: 600, marginTop: '4px', textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: 'var(--color-gray-500)' }}>{Math.round(dia.multiplicadorJornal * 100)}% del jornal</span>
            <span>{dia.ajusteManual && <small style={{ display: 'block', color: 'var(--color-warning)', fontWeight: 600 }}>AJUSTADO</small>}${dia.totalDia.toLocaleString()}</span>
        </div>
    </div>
}
