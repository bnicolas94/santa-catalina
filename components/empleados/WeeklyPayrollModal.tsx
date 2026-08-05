"use client"

import { useState, useEffect } from 'react'
import type {
    BorradorLiquidacionUI,
    ConceptoSalarialUI,
    DiaLiquidacionUI,
    EmpleadoLiquidable,
    LiquidacionPagadaUI,
    ResultadoLiquidacionUI,
} from './weeklyPayroll.types'
import { minutesToTimeDisplay, obtenerAlertasLiquidacion, parseTimeToMinutes, recalcularDiaPorHoras, recalcularResultado } from './weeklyPayroll.utils'
import { WeeklyPayrollControls } from './WeeklyPayrollControls'
import { WeeklyPayrollHeader } from './WeeklyPayrollHeader'
import { WeeklyPayrollFooter } from './WeeklyPayrollFooter'
import { WeeklyPayrollResults } from './WeeklyPayrollResults'

interface WeeklyPayrollModalProps {
    empleados: EmpleadoLiquidable[]
    onClose: () => void
    onSuccess: () => void
}

export function WeeklyPayrollModal({ empleados, onClose, onSuccess }: WeeklyPayrollModalProps) {
    const [fechaInicio, setFechaInicio] = useState(() => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes
        return new Date(d.setDate(diff)).toISOString().split('T')[0]
    })
    const [fechaFin, setFechaFin] = useState(() => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? 0 : 7) // Domingo
        return new Date(d.setDate(diff)).toISOString().split('T')[0]
    })
    const [cajaId, setCajaId] = useState('caja_chica')
    const [loading, setLoading] = useState(false)
    const [resultados, setResultados] = useState<ResultadoLiquidacionUI[]>([])
    const [periodoNombre, setPeriodoNombre] = useState('')
    const [confirmando, setConfirmando] = useState(false)
    const [guardandoBorrador, setGuardandoBorrador] = useState(false)
    const [borradorCargado, setBorradorCargado] = useState(false)
    const [empleadosExcluidos, setEmpleadosExcluidos] = useState<EmpleadoLiquidable[]>([])
    const [empleadosDeVacaciones, setEmpleadosDeVacaciones] = useState<EmpleadoLiquidable[]>([])
    const [conceptos, setConceptos] = useState<ConceptoSalarialUI[]>([])
    const [updatingStatusDate, setUpdatingStatusDate] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/conceptos').then(res => res.json()).then(setConceptos).catch(console.error)
    }, [])

    useEffect(() => {
        const [sy, sm, sd] = fechaInicio.split('-').map(Number);
        const [ey, em, ed] = fechaFin.split('-').map(Number);
        const d_start = new Date(sy, sm - 1, sd);
        const d_end = new Date(ey, em - 1, ed);
        setPeriodoNombre(`Semana del ${d_start.toLocaleDateString()} al ${d_end.toLocaleDateString()}`)
    }, [fechaInicio, fechaFin])

    const handleCalcular = async () => {
        setLoading(true)
        setResultados([])
        setEmpleadosExcluidos([])
        setEmpleadosDeVacaciones([])
        
        try {
            // 1. Determinar nombre del periodo para buscar liquidaciones existentes
            const [sy, sm, sd] = fechaInicio.split('-').map(Number);
            const [ey, em, ed] = fechaFin.split('-').map(Number);
            const p_name = `Semana del ${new Date(sy, sm - 1, sd).toLocaleDateString()} al ${new Date(ey, em - 1, ed).toLocaleDateString()}`;

            // 2. Buscar liquidaciones YA PAGADAS en el sistema (traemos las recientes para filtrar en JS)
            const pagadasRes = await fetch(`/api/liquidaciones`)
            const liquidacionesPagadas: LiquidacionPagadaUI[] = pagadasRes.ok ? await pagadasRes.json() : []
            
            // Función para verificar si un periodo de liquidación coincide con las fechas buscadas
            const coincidePeriodo = (periodoStr: string) => {
                const s = fechaInicio.split('-').reverse().join('/') // DD/MM/YYYY o D/M/YYYY según split
                const e = fechaFin.split('-').reverse().join('/')
                
                // Normalizar fechas para comparación (quitar ceros a la izquierda si los hay)
                const sNorm = s.split('/').map(n => parseInt(n)).join('/')
                const eNorm = e.split('/').map(n => parseInt(n)).join('/')
                
                return (periodoStr.includes(s) && periodoStr.includes(e)) || 
                       (periodoStr.includes(sNorm) && periodoStr.includes(eNorm))
            }

            const idsPagados = new Set(
                liquidacionesPagadas
                    .filter(l => coincidePeriodo(l.periodo))
                    .map(l => l.empleadoId)
            )

            // 3. Filtrar empleados: Solo activos y que NO tengan liquidación pagada en este rango
            const empleadosMixtos = empleados.filter(e => e.activo && e.modalidadPago === 'MENSUAL_MIXTA')
            const idsMixtos = new Set(empleadosMixtos.map(empleado => empleado.id))
            const empleadosSemanales = empleados.filter(e => e.activo && e.modalidadPago !== 'MENSUAL_MIXTA' && !idsPagados.has(e.id))
            const empleadosParaLiquidar = [...empleadosSemanales, ...empleadosMixtos]
            const excluidos = empleados.filter(e => e.activo && e.modalidadPago !== 'MENSUAL_MIXTA' && idsPagados.has(e.id))
            setEmpleadosExcluidos(excluidos)

            if (empleadosParaLiquidar.length === 0) {
                setLoading(false)
                if (excluidos.length > 0) {
                    alert('Todos los empleados activos ya tienen una liquidación procesada para este periodo.')
                } else {
                    alert('No hay empleados activos para calcular.')
                }
                return
            }

            // 4. Pedir previsualización
            const res = await fetch('/api/liquidaciones/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoIds: empleadosParaLiquidar.map(e => e.id),
                    fechaInicio,
                    fechaFin
                })
            })
            if (!res.ok) throw new Error('No se pudo calcular la liquidación semanal.')
            const data: Omit<ResultadoLiquidacionUI, 'adicionales'>[] = await res.json()
            const dataConModalidad = data.map(resultado => ({
                ...resultado,
                esSeguimientoMensualMixto: idsMixtos.has(resultado.empleadoId),
            }))
            const idsDeVacaciones = new Set(dataConModalidad
                .filter(resultado => resultado.excluirLiquidacionSemanal && !resultado.esSeguimientoMensualMixto)
                .map(resultado => resultado.empleadoId))
            const vacaciones = empleadosSemanales.filter(empleado => idsDeVacaciones.has(empleado.id))
            const dataLiquidable = dataConModalidad.filter(resultado => resultado.esSeguimientoMensualMixto || !resultado.excluirLiquidacionSemanal)
            setEmpleadosDeVacaciones(vacaciones)

            if (dataLiquidable.length === 0) {
                setResultados([])
                setBorradorCargado(false)
                return
            }
            
            // 5. Buscar borradores guardados para este periodo
            try {
                const bRes = await fetch(`/api/liquidaciones/borrador?periodo=${encodeURIComponent(p_name)}`)
                if (bRes.ok) {
                    const borradores: BorradorLiquidacionUI[] = await bRes.json()
                    if (borradores.length > 0) {
                        const merged: ResultadoLiquidacionUI[] = dataLiquidable.map(r => {
                            if (r.esSeguimientoMensualMixto) return { ...r, adicionales: [] }
                            const b = borradores.find(borrador => borrador.empleadoId === r.empleadoId)
                            const extraItems = b?.items || []
                            const montoExtrasItems = extraItems.reduce((acc, item) => acc + item.montoCalculado, 0)
                            
                            if (b) {
                                const currentDesglose = b.desglose || r.desglosePorDia;
                                const currentHsExtrasBase = currentDesglose.reduce((acc, d) => acc + (d.horasExtras || 0), 0);
                                const currentMontoExtrasBase = currentDesglose.reduce((acc, d) => acc + (d.valorExtra || 0), 0);
                                const currentMontoFeriado = currentDesglose.reduce((acc, d) => acc + (d.valorFeriado || 0), 0);
                                const currentSueldoBase = currentDesglose.reduce((acc, d) => acc + (d.valorDiaBase || 0), 0);
                                
                                const adjustmentHs = b.ajusteHorasExtras || 0;
                                const adjustmentMoney = Math.round(adjustmentHs * r.valorHoraExtra);
                                const totalMontoExtras = currentMontoExtrasBase + adjustmentMoney;
                                const diasTrabajados = currentDesglose.filter(d => d.multiplicadorJornal > 0).length;

                                return {
                                    ...r,
                                    desglosePorDia: currentDesglose,
                                    sueldoBase: currentSueldoBase,
                                    horasExtras: currentHsExtrasBase,
                                    ajusteHorasExtras: adjustmentHs,
                                    montoHorasExtras: totalMontoExtras,
                                    montoHorasFeriado: currentMontoFeriado,
                                    adicionales: extraItems,
                                    diasTrabajados: diasTrabajados,
                                    totalNeto: currentSueldoBase + totalMontoExtras + currentMontoFeriado + montoExtrasItems - (r.descuentoPrestamos || 0),
                                    borradorId: b.id
                                }
                            }
                            return { ...r, adicionales: [] };
                        })
                        setResultados(merged)
                        setBorradorCargado(true)
                    } else {
                        setResultados(dataLiquidable.map(r => ({ ...r, adicionales: [] })))
                        setBorradorCargado(false)
                    }
                } else {
                    setResultados(dataLiquidable.map(r => ({ ...r, adicionales: [] })))
                }
            } catch {
                setResultados(dataLiquidable.map(r => ({ ...r, adicionales: [] })))
            }
        } catch (error) {
            console.error(error)
            alert('Error al calcular')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmarTodo = async () => {
        const validResults = resultados.filter(r => !r.error && !r.esSeguimientoMensualMixto)
        if (validResults.length === 0) {
            alert('No hay liquidaciones semanales para pagar. Guardá los seguimientos mixtos desde el botón de la izquierda.')
            return
        }

        const bloqueos = validResults.flatMap(resultado => obtenerAlertasLiquidacion(resultado)
            .filter(alerta => alerta.nivel === 'error')
            .map(alerta => `${resultado.empleadoNombre}: ${alerta.mensaje}`))
        if (bloqueos.length > 0) {
            alert(`No se puede confirmar la liquidación:\n\n${bloqueos.join('\n')}`)
            return
        }

        if (!confirm(`¿Confirmas la liquidación final de ${validResults.length} empleados? Esto generará los egresos de caja.`)) return

        setConfirmando(true)
        try {
            for (const result of validResults) {
                const res = await fetch('/api/liquidaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        empleadoId: result.empleadoId,
                        periodo: periodoNombre,
                        fechaInicio,
                        fechaFin,
                        cajaId,
                        calculatedData: result,
                        adicionales: result.adicionales || []
                    })
                })
                if (!res.ok) {
                    const err = await res.json()
                    throw new Error(`Error con ${result.empleadoNombre}: ${err.error}`)
                }
                
                // Si había un borrador, borrarlo o se convierte automáticamente? 
                // Nuestra API actual de POST /api/liquidaciones CREA uno nuevo.
                // Podríamos borrar el borrador aquí si quisiéramos, pero el GET /api/liquidaciones/borrador solo trae "estado: borrador".
            }
            alert('¡Liquidaciones procesadas con éxito!')
            onSuccess()
            onClose()
        } catch (error: unknown) {
            alert(error instanceof Error ? error.message : 'Error al confirmar liquidaciones')
        } finally {
            setConfirmando(false)
        }
    }

    const handleGuardarTodoBorrador = async () => {
        setGuardandoBorrador(true)
        try {
            for (const result of resultados) {
                if (result.error) continue;
                if (result.esSeguimientoMensualMixto) {
                    const respuesta = await fetch('/api/empleados/seguimientos-semanales', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            empleadoId: result.empleadoId,
                            fechaInicio,
                            fechaFin,
                            calculatedData: result,
                        }),
                    })
                    const data = await respuesta.json()
                    if (!respuesta.ok) throw new Error(`${result.empleadoNombre}: ${data.error || 'no se pudo guardar el seguimiento'}`)
                    continue
                }
                const respuesta = await fetch('/api/liquidaciones/borrador', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        empleadoId: result.empleadoId,
                        periodo: periodoNombre,
                        calculatedData: {
                            ...result,
                            adicionales: result.adicionales || []
                        }
                    })
                })
                if (!respuesta.ok) throw new Error(`${result.empleadoNombre}: no se pudo guardar el borrador`)
            }
            setBorradorCargado(true)
            setResultados(actual => actual.map(resultado => resultado.esSeguimientoMensualMixto
                ? { ...resultado, seguimientoGuardado: true, diasSeguimientoGuardados: resultado.desglosePorDia.length }
                : resultado))
            alert('Borradores y seguimientos semanales guardados correctamente.')
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Error al guardar la información semanal')
        } finally {
            setGuardandoBorrador(false)
        }
    }

    const handleRecalcularEmpleado = async (empleadoId: string) => {
        try {
            const res = await fetch('/api/liquidaciones/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoIds: [empleadoId],
                    fechaInicio,
                    fechaFin
                })
            })
            if (!res.ok) return;
            const [newData]: Omit<ResultadoLiquidacionUI, 'adicionales'>[] = await res.json()
            
            setResultados(prev => prev.map(r => {
                if (r.empleadoId === empleadoId) {
                    const adj = r.ajusteHorasExtras || 0;
                    
                    const nuevoDesglose = newData.desglosePorDia.map(newDia => {
                        const oldDia = r.desglosePorDia.find(d => d.fecha === newDia.fecha);
                        if (oldDia) {
                            const hasStateChanged = (
                                oldDia.horasTrabajadas !== newDia.horasTrabajadas ||
                                oldDia.esJustificado !== newDia.esJustificado ||
                                oldDia.esInasistencia !== newDia.esInasistencia ||
                                oldDia.inasistenciaTipo !== newDia.inasistenciaTipo ||
                                oldDia.esFranco !== newDia.esFranco
                            );
                            
                            const mult = hasStateChanged 
                                ? (newDia.multiplicadorJornal !== undefined ? newDia.multiplicadorJornal : 1)
                                : (oldDia.multiplicadorJornal !== undefined ? oldDia.multiplicadorJornal : 1);
                                
                            const manualExtras = oldDia.horasExtras || 0;
                            
                            const valorDiaBaseAjustado = Math.round(newDia.jornalBase * mult);
                            const valorExtraAjustado = Math.round(manualExtras * newData.valorHoraExtra);
                            
                            let nuevoValorFeriado = newDia.valorFeriado;
                            if (newDia.esFeriado) {
                                nuevoValorFeriado = Math.round((newDia.jornalBase * mult) * 0.5);
                            }
                            
                            return {
                                ...newDia,
                                multiplicadorJornal: mult,
                                horasExtras: manualExtras,
                                valorDiaBase: valorDiaBaseAjustado,
                                valorExtra: valorExtraAjustado,
                                valorFeriado: nuevoValorFeriado,
                                totalDia: Math.round(valorDiaBaseAjustado + valorExtraAjustado + nuevoValorFeriado)
                            }
                        }
                        return newDia;
                    });

                    const currentHsExtrasBase = nuevoDesglose.reduce((acc, d) => acc + (d.horasExtras || 0), 0);
                    const currentMontoExtrasBase = nuevoDesglose.reduce((acc, d) => acc + (d.valorExtra || 0), 0);
                    const currentMontoFeriado = nuevoDesglose.reduce((acc, d) => acc + (d.valorFeriado || 0), 0);
                    const currentSueldoBase = nuevoDesglose.reduce((acc, d) => acc + (d.valorDiaBase || 0), 0);
                    
                    const adjMoney = Math.round(adj * newData.valorHoraExtra);
                    const totalMontoExtras = currentMontoExtrasBase + adjMoney;
                    const adicionalesOriginales = r.adicionales || [];
                    const montoExtrasItems = adicionalesOriginales.reduce((acc, item) => acc + item.montoCalculado, 0);
                    const diasTrabajados = nuevoDesglose.filter(d => d.multiplicadorJornal > 0).length;

                    return {
                        ...newData,
                        esSeguimientoMensualMixto: r.esSeguimientoMensualMixto,
                        seguimientoGuardado: r.esSeguimientoMensualMixto ? false : r.seguimientoGuardado,
                        desglosePorDia: nuevoDesglose,
                        sueldoBase: currentSueldoBase,
                        horasExtras: currentHsExtrasBase,
                        ajusteHorasExtras: adj,
                        montoHorasExtras: totalMontoExtras,
                        montoHorasFeriado: currentMontoFeriado,
                        adicionales: adicionalesOriginales,
                        diasTrabajados: diasTrabajados,
                        totalNeto: currentSueldoBase + totalMontoExtras + currentMontoFeriado + montoExtrasItems - (newData.descuentoPrestamos || 0)
                    }
                }
                return r;
            }))
        } catch (e) { console.error(e) }
    }

    const handleJustificar = async (empleadoId: string, fecha: string) => {
        try {
            const res = await fetch('/api/fichadas/justificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleadoId, fecha })
            })
            if (res.ok) await handleRecalcularEmpleado(empleadoId)
            else alert('Error al justificar')
        } catch (error) { console.error(error) }
    }

    const handleQuitarJustificacion = async (empleadoId: string, fecha: string) => {
        try {
            const res = await fetch(`/api/fichadas/justificar?empleadoId=${empleadoId}&fecha=${fecha}`, {
                method: 'DELETE'
            })
            if (res.ok) await handleRecalcularEmpleado(empleadoId)
            else alert('Error al quitar justificación')
        } catch (error) { console.error(error) }
    }

    const handleStatusChange = async (empleadoId: string, fecha: string, newStatus: string) => {
        setUpdatingStatusDate(`${empleadoId}-${fecha}`)
        try {
            const response = await fetch('/api/empleados/asistencia-diaria', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    empleadoId,
                    fecha,
                    status: newStatus,
                }),
            })

            if (!response.ok) {
                const errJson = await response.json()
                throw new Error(errJson.error || 'Error al actualizar asistencia')
            }

            // Recalcular el sueldo del empleado en tiempo real en la pantalla
            await handleRecalcularEmpleado(empleadoId)
        } catch (error: unknown) {
            alert('Error: ' + (error instanceof Error ? error.message : 'No se pudo actualizar el estado'))
        } finally {
            setUpdatingStatusDate(null)
        }
    }

    const getDiaStatus = (dia: DiaLiquidacionUI) => {
        if (dia.tipoInasistencia === 'VACACIONES') {
            return 'VACACIONES'
        }
        if (dia.motivoInasistencia === 'Enfermedad') {
            return 'ENFERMEDAD'
        }
        if (dia.tipoInasistencia === 'JUSTIFICADA_PAGA') {
            return 'CON_AVISO'
        }
        if (dia.motivoInasistencia === 'Franco' || dia.tipoInasistencia === 'FRANCO') {
            return 'FRANCO'
        }
        if (dia.motivoInasistencia === 'Feriado' || dia.tipoInasistencia === 'FERIADO') {
            return 'FERIADO'
        }
        if (dia.motivoInasistencia === 'Trabajó' || dia.tipoInasistencia === 'TRABAJO') {
            return 'TRABAJO'
        }
        if (dia.tipoInasistencia === 'INJUSTIFICADA') {
            return 'SIN_AVISO'
        }
        if (dia.tipoInasistencia === 'JUSTIFICADA') {
            return 'CON_AVISO'
        }
        
        if (dia.horasTrabajadas > 0) {
            return 'TRABAJO'
        }
        if (dia.esFeriado) {
            return 'FERIADO'
        }
        
        // Calcular si es Domingo (Franco por defecto)
        const dayOfWeekNum = new Date(`${dia.fecha}T12:00:00`).getDay()
        if (dayOfWeekNum === 0) return 'FRANCO'
        
        return 'TRABAJO'
    }

    const handleAjusteChange = (empleadoId: string, value: string) => {
        const val = parseFloat(value) || 0;
        setResultados(prev => prev.map(r => {
            if (r.empleadoId === empleadoId) {
                return recalcularResultado({ ...r, ajusteHorasExtras: val })
            }
            return r;
        }))
        setBorradorCargado(false)
    }

    const handleAddAdicional = (empleadoId: string, conceptoId: string, monto: number) => {
        if (!conceptoId || monto === 0) return;
        const concepto = conceptos.find(c => c.id === conceptoId);
        
        setResultados(prev => prev.map(r => {
            if (r.empleadoId === empleadoId) {
                const nuevosAdicionales = [...(r.adicionales || []), {
                    conceptoSalarialId: conceptoId,
                    nombre: concepto?.nombre || 'Otros',
                    montoCalculado: monto
                }];
                return recalcularResultado({ ...r, adicionales: nuevosAdicionales })
            }
            return r;
        }));
        setBorradorCargado(false);
    }

    const handleRemoveAdicional = (empleadoId: string, index: number) => {
        setResultados(prev => prev.map(r => {
            if (r.empleadoId === empleadoId) {
                const nuevosAdicionales = r.adicionales.filter((_, i) => i !== index);
                return recalcularResultado({ ...r, adicionales: nuevosAdicionales })
            }
            return r;
        }));
        setBorradorCargado(false);
    }

    const handleTimeChange = (empleadoId: string, fecha: string, field: 'entrada' | 'salida', value: string) => {
        if (!value) return
        setResultados(prev => prev.map(r => {
            if (r.empleadoId !== empleadoId) return r

            const nuevoDesglose = r.desglosePorDia.map(dia => {
                if (dia.fecha !== fecha) return dia

                const newDisplay = minutesToTimeDisplay(parseInt(value.split(':')[0]) * 60 + parseInt(value.split(':')[1]))
                const updatedEntrada = field === 'entrada' ? newDisplay : dia.entrada
                const updatedSalida = field === 'salida' ? newDisplay : dia.salida

                // Recalcular horas trabajadas
                const entradaMins = parseTimeToMinutes(updatedEntrada)
                const salidaMins = parseTimeToMinutes(updatedSalida)

                let newHorasTrabajadas = dia.horasTrabajadas
                if (entradaMins !== null && salidaMins !== null) {
                    let diffMins = salidaMins - entradaMins
                    if (diffMins < 0) diffMins += 24 * 60 // Cruce de medianoche
                    newHorasTrabajadas = parseFloat((diffMins / 60).toFixed(2))
                    
                    // Determinar jornada esperada desde el jornal
                    // Redondear extras al 0.5 más cercano
                }

                return recalcularDiaPorHoras({
                    ...dia,
                    entrada: updatedEntrada,
                    salida: updatedSalida,
                }, newHorasTrabajadas, r.horasJornada || 8, r.valorHoraExtra)
            })

            return recalcularResultado({
                ...r,
                desglosePorDia: nuevoDesglose,
                seguimientoGuardado: r.esSeguimientoMensualMixto ? false : r.seguimientoGuardado,
            })
        }))
        setBorradorCargado(false)
    }

    const handleHoursChange = (empleadoId: string, fecha: string, value: string) => {
        const horas = Number(value)
        if (!Number.isFinite(horas)) return
        setResultados(prev => prev.map(resultado => {
            if (resultado.empleadoId !== empleadoId) return resultado
            const desglosePorDia = resultado.desglosePorDia.map(dia => dia.fecha === fecha
                ? recalcularDiaPorHoras(dia, horas, resultado.horasJornada || 8, resultado.valorHoraExtra)
                : dia)
            return recalcularResultado({
                ...resultado,
                desglosePorDia,
                seguimientoGuardado: resultado.esSeguimientoMensualMixto ? false : resultado.seguimientoGuardado,
            })
        }))
        setBorradorCargado(false)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }}>
                <WeeklyPayrollHeader onClose={onClose} />
                <div className="modal-body" style={{ overflowY: 'auto' }}>
                    <WeeklyPayrollControls
                        fechaInicio={fechaInicio}
                        fechaFin={fechaFin}
                        cajaId={cajaId}
                        loading={loading}
                        empleadosExcluidos={empleadosExcluidos}
                        empleadosDeVacaciones={empleadosDeVacaciones}
                        onFechaInicioChange={setFechaInicio}
                        onFechaFinChange={setFechaFin}
                        onCajaChange={setCajaId}
                        onCalcular={handleCalcular}
                    />
                    <WeeklyPayrollResults
                        resultados={resultados}
                        empleados={empleados}
                        conceptos={conceptos}
                        updatingStatusDate={updatingStatusDate}
                        getDiaStatus={getDiaStatus}
                        onAjusteChange={handleAjusteChange}
                        onTimeChange={handleTimeChange}
                        onHoursChange={handleHoursChange}
                        onJustificar={handleJustificar}
                        onQuitarJustificacion={handleQuitarJustificacion}
                        onStatusChange={handleStatusChange}
                        onAddAdicional={handleAddAdicional}
                        onRemoveAdicional={handleRemoveAdicional}
                    />
                </div>
                <WeeklyPayrollFooter
                    cantidadResultados={resultados.length}
                    cantidadLiquidables={resultados.filter(resultado => !resultado.error && !resultado.esSeguimientoMensualMixto).length}
                    cantidadSeguimientos={resultados.filter(resultado => !resultado.error && resultado.esSeguimientoMensualMixto).length}
                    confirmando={confirmando}
                    guardandoBorrador={guardandoBorrador}
                    borradorCargado={borradorCargado}
                    onGuardarBorrador={handleGuardarTodoBorrador}
                    onConfirmar={handleConfirmarTodo}
                    onClose={onClose}
                />
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
                .modal { background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
