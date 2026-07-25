"use client"

import { Fragment, useState } from 'react'
import { WeeklyPayrollAdditionals } from './WeeklyPayrollAdditionals'
import { WeeklyPayrollDayCard } from './WeeklyPayrollDayCard'
import { WeeklyPayrollHoursDebt } from './WeeklyPayrollHoursDebt'
import type { ConceptoSalarialUI, DiaLiquidacionUI, EmpleadoLiquidable, ResultadoLiquidacionUI } from './weeklyPayroll.types'
import { obtenerAlertasLiquidacion } from './weeklyPayroll.utils'

interface Props {
    resultados: ResultadoLiquidacionUI[]
    empleados: EmpleadoLiquidable[]
    conceptos: ConceptoSalarialUI[]
    updatingStatusDate: string | null
    getDiaStatus: (dia: DiaLiquidacionUI) => string
    onClearDebt: (empleadoId: string) => void
    onAjusteChange: (empleadoId: string, valor: string) => void
    onTimeChange: (empleadoId: string, fecha: string, campo: 'entrada' | 'salida', valor: string) => void
    onHoursChange: (empleadoId: string, fecha: string, valor: string) => void
    onJustificar: (empleadoId: string, fecha: string) => void
    onQuitarJustificacion: (empleadoId: string, fecha: string) => void
    onStatusChange: (empleadoId: string, fecha: string, estado: string) => void
    onAddAdicional: (empleadoId: string, conceptoId: string, monto: number) => void
    onRemoveAdicional: (empleadoId: string, index: number) => void
    onDeferHours: (empleadoId: string, horas: string, monto: number) => void
    onManualDebt: (empleadoId: string, horas: string, monto: number) => void
}

export function WeeklyPayrollResults(props: Props) {
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    if (props.resultados.length === 0) return <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-gray-400)' }}>
        <p style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📊</p>
        <p>Presiona &quot;Calcular Sueldos&quot; para generar la previsualización del periodo.</p>
    </div>

    const totalGeneral = props.resultados.reduce((total, resultado) => total + resultado.totalNeto, 0)
    const totalBase = props.resultados.reduce((total, resultado) => total + resultado.sueldoBase, 0)
    const totalExtras = props.resultados.reduce((total, resultado) => total + resultado.montoHorasExtras + resultado.montoHorasFeriado + resultado.montoHorasPendientes, 0)
    const totalDeducciones = props.resultados.reduce((total, resultado) => total + resultado.descuentoPrestamos, 0)
    const ajustesManuales = props.resultados.reduce((total, resultado) => total + resultado.desglosePorDia.filter(dia => dia.ajusteManual).length, 0)
    return <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {[
                ['Sueldo base', totalBase, 'var(--color-gray-900)'],
                ['Extras', totalExtras, 'var(--color-success)'],
                ['Deducciones', -totalDeducciones, 'var(--color-danger)'],
                ['Total a pagar', totalGeneral, 'var(--color-primary)'],
            ].map(([etiqueta, monto, color]) => <div key={String(etiqueta)} style={{ padding: 'var(--space-4)', background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
                <div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{etiqueta}</div>
                <div style={{ color: String(color), fontSize: 'var(--text-xl)', fontWeight: 800, marginTop: '4px' }}>${Number(monto).toLocaleString()}</div>
            </div>)}
        </div>
        {ajustesManuales > 0 && <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            {ajustesManuales} jornada{ajustesManuales === 1 ? '' : 's'} con ajustes manuales. Revisalas antes de confirmar.
        </div>}
        <div className="table-container shadow-sm" style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'white' }}>
        <table className="table table-sm">
            <thead style={{ backgroundColor: 'var(--color-gray-50)' }}><tr>
                <th style={{ width: '30px' }}></th><th>Empleado</th><th style={{ textAlign: 'center' }}>Días</th><th style={{ textAlign: 'right' }}>Sueldo Base</th><th style={{ textAlign: 'center', width: '90px' }}>Ajuste (hs)</th><th style={{ textAlign: 'right' }}>Hs. Extras</th><th style={{ textAlign: 'right' }}>Recargo Fer.</th><th style={{ textAlign: 'right' }}>Deducciones</th><th style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>Neto a Pagar</th>
            </tr></thead>
            <tbody>{props.resultados.map(resultado => {
                const alertas = obtenerAlertasLiquidacion(resultado)
                const errores = alertas.filter(alerta => alerta.nivel === 'error').length
                const advertencias = alertas.length - errores
                return <Fragment key={resultado.empleadoId}>
                <tr onClick={() => !resultado.error && setExpandedRow(expandedRow === resultado.empleadoId ? null : resultado.empleadoId)} style={{ cursor: resultado.error ? 'default' : 'pointer', backgroundColor: expandedRow === resultado.empleadoId ? 'var(--color-info-bg)' : 'transparent', opacity: resultado.error ? 0.7 : 1 }}>
                    <td>{!resultado.error && (expandedRow === resultado.empleadoId ? '▼' : '▶')}</td>
                    <td style={{ fontWeight: 600 }}>
                        {resultado.empleadoNombre || props.empleados.find(empleado => empleado.id === resultado.empleadoId)?.nombre || 'Empleado'}
                        {resultado.error && <span className="badge badge-danger" style={{ marginLeft: 'var(--space-2)', fontSize: '10px' }}>ERROR</span>}
                        {errores > 0 && <span className="badge badge-danger" style={{ marginLeft: 'var(--space-2)', fontSize: '9px' }}>{errores} BLOQUEO{errores === 1 ? '' : 'S'}</span>}
                        {advertencias > 0 && <span className="badge badge-warning" style={{ marginLeft: 'var(--space-2)', fontSize: '9px' }}>{advertencias} REVISAR</span>}
                        {resultado.montoHorasPendientes > 0 && <div style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            ⚠️ HS ADEUDADAS: {resultado.horasPendientes}hs (${resultado.montoHorasPendientes.toLocaleString()})
                            <button className="btn btn-ghost" style={{ padding: 0, height: '14px', width: '14px', color: 'var(--color-danger)', fontSize: '10px' }} title="Borrar deuda" onClick={evento => { evento.stopPropagation(); props.onClearDebt(resultado.empleadoId) }}>🗑️</button>
                        </div>}
                    </td>
                    {resultado.error ? <td colSpan={7} style={{ color: 'var(--color-danger)', fontSize: '12px', fontStyle: 'italic' }}>Error: {resultado.error}</td> : <>
                        <td style={{ textAlign: 'center' }}>{resultado.diasTrabajados}</td><td style={{ textAlign: 'right' }}>${resultado.sueldoBase.toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }}><input type="number" step="0.5" className="form-input" style={{ padding: '2px 5px', fontSize: '11px', textAlign: 'center', height: '24px' }} value={resultado.ajusteHorasExtras || ''} onChange={evento => props.onAjusteChange(resultado.empleadoId, evento.target.value)} onClick={evento => evento.stopPropagation()} placeholder="0" /></td>
                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}><span style={{ fontSize: '10px', display: 'block' }}>({resultado.horasExtras + (resultado.ajusteHorasExtras || 0)}h){(resultado.ajusteHorasExtras || 0) !== 0 && <span style={{ color: (resultado.ajusteHorasExtras || 0) > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}> {(resultado.ajusteHorasExtras || 0) > 0 ? '+' : ''}{resultado.ajusteHorasExtras}</span>}</span>${resultado.montoHorasExtras.toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{resultado.montoHorasFeriado > 0 && <span className="badge badge-warning" style={{ fontSize: '9px' }}>FER</span>}${resultado.montoHorasFeriado.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>{resultado.descuentoPrestamos > 0 && <span style={{ fontSize: '10px' }}>Préstamos</span>}-${resultado.descuentoPrestamos.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>${resultado.totalNeto.toLocaleString()}</td>
                    </>}
                </tr>
                {expandedRow === resultado.empleadoId && <tr style={{ backgroundColor: 'var(--color-gray-50)' }}><td colSpan={9} style={{ padding: 'var(--space-4)' }}>
                    {alertas.length > 0 && <div style={{ display: 'grid', gap: '6px', marginBottom: 'var(--space-3)' }}>{alertas.map((alerta, indice) => <div key={`${alerta.fecha || 'general'}-${indice}`} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: alerta.nivel === 'error' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)', color: alerta.nivel === 'error' ? 'var(--color-danger)' : 'var(--color-warning)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{alerta.fecha ? `${alerta.fecha}: ` : ''}{alerta.mensaje}</div>)}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>{resultado.desglosePorDia.map(dia => <WeeklyPayrollDayCard key={dia.fecha} dia={dia} empleadoId={resultado.empleadoId} actualizandoEstado={props.updatingStatusDate === `${resultado.empleadoId}-${dia.fecha}`} estado={props.getDiaStatus(dia)} onTimeChange={props.onTimeChange} onHoursChange={props.onHoursChange} onJustificar={props.onJustificar} onQuitarJustificacion={props.onQuitarJustificacion} onStatusChange={props.onStatusChange} />)}</div>
                    <WeeklyPayrollAdditionals empleadoId={resultado.empleadoId} adicionales={resultado.adicionales} conceptos={props.conceptos} onAdd={props.onAddAdicional} onRemove={props.onRemoveAdicional} />
                    <WeeklyPayrollHoursDebt empleadoId={resultado.empleadoId} valorHoraExtra={resultado.valorHoraExtra} onDefer={props.onDeferHours} onManualDebt={props.onManualDebt} />
                </td></tr>}
            </Fragment>})}</tbody>
            <tfoot style={{ backgroundColor: 'var(--color-gray-100)', fontWeight: 'bold' }}><tr><td colSpan={8} style={{ textAlign: 'right' }}>TOTAL A PAGAR:</td><td style={{ textAlign: 'right', fontSize: 'var(--text-lg)', color: 'var(--color-primary)' }}>${totalGeneral.toLocaleString()}</td></tr></tfoot>
        </table>
        </div>
    </>
}
