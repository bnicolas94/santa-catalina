"use client"

import { useState, useEffect, Fragment } from 'react'
import { ResumenSemanal, DiaTrabajado } from '@/lib/services/payroll.service'

interface WeeklyPayrollModalProps {
    empleados: any[]
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
    const [resultados, setResultados] = useState<any[]>([])
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [periodoNombre, setPeriodoNombre] = useState('')
    const [confirmando, setConfirmando] = useState(false)
    const [guardandoBorrador, setGuardandoBorrador] = useState(false)
    const [borradorCargado, setBorradorCargado] = useState(false)
    const [empleadosExcluidos, setEmpleadosExcluidos] = useState<any[]>([])
    const [conceptos, setConceptos] = useState<any[]>([])
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
        
        try {
            // 1. Determinar nombre del periodo para buscar liquidaciones existentes
            const [sy, sm, sd] = fechaInicio.split('-').map(Number);
            const [ey, em, ed] = fechaFin.split('-').map(Number);
            const p_name = `Semana del ${new Date(sy, sm - 1, sd).toLocaleDateString()} al ${new Date(ey, em - 1, ed).toLocaleDateString()}`;

            // 2. Buscar liquidaciones YA PAGADAS en el sistema (traemos las recientes para filtrar en JS)
            const pagadasRes = await fetch(`/api/liquidaciones`)
            const liquidacionesPagadas = pagadasRes.ok ? await pagadasRes.json() : []
            
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
                    .filter((l: any) => coincidePeriodo(l.periodo))
                    .map((l: any) => l.empleadoId)
            )

            // 3. Filtrar empleados: Solo activos y que NO tengan liquidación pagada en este rango
            const empleadosParaLiquidar = empleados.filter(e => e.activo && !idsPagados.has(e.id))
            const excluidos = empleados.filter(e => e.activo && idsPagados.has(e.id))
            setEmpleadosExcluidos(excluidos)

            if (empleadosParaLiquidar.length === 0) {
                setLoading(false)
                if (excluidos.length > 0) {
                    alert('Todos los empleados activos ya tienen una liquidación procesada para este periodo.')
                } else {
                    alert('No hay empleados activos para liquidar.')
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
            const data = await res.json()
            
            // 5. Buscar borradores guardados para este periodo
            try {
                const bRes = await fetch(`/api/liquidaciones/borrador?periodo=${encodeURIComponent(p_name)}`)
                if (bRes.ok) {
                    const borradores = await bRes.json()
                    if (borradores.length > 0) {
                        const merged = data.map((r: any) => {
                            const b = borradores.find((b: any) => b.empleadoId === r.empleadoId)
                            const extraItems = b?.items || []
                            const montoExtrasItems = extraItems.reduce((acc: number, item: any) => acc + item.montoCalculado, 0)
                            
                            if (b) {
                                const currentDesglose = b.desglose || r.desglosePorDia;
                                const currentHsExtrasBase = currentDesglose.reduce((acc: number, d: any) => acc + (d.horasExtras || 0), 0);
                                const currentMontoExtrasBase = currentDesglose.reduce((acc: number, d: any) => acc + (d.valorExtra || 0), 0);
                                const currentMontoFeriado = currentDesglose.reduce((acc: number, d: any) => acc + (d.valorFeriado || 0), 0);
                                const currentSueldoBase = currentDesglose.reduce((acc: number, d: any) => acc + (d.valorDiaBase || 0), 0);
                                
                                const adjustmentHs = b.ajusteHorasExtras || 0;
                                const adjustmentMoney = Math.round(adjustmentHs * r.valorHoraExtra);
                                const totalMontoExtras = currentMontoExtrasBase + adjustmentMoney;
                                const diasTrabajados = currentDesglose.filter((d: any) => d.multiplicadorJornal > 0 || d.multiplicadorJornal === undefined).length;

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
                                    totalNeto: currentSueldoBase + totalMontoExtras + currentMontoFeriado + montoExtrasItems + (r.montoHorasPendientes || 0) - (r.descuentoPrestamos || 0),
                                    borradorId: b.id
                                }
                            }
                            return { ...r, adicionales: [] };
                        })
                        setResultados(merged)
                        setBorradorCargado(true)
                    } else {
                        setResultados(data.map((r: any) => ({ ...r, adicionales: [] })))
                        setBorradorCargado(false)
                    }
                } else {
                    setResultados(data.map((r: any) => ({ ...r, adicionales: [] })))
                }
            } catch (e) {
                setResultados(data)
            }
        } catch (error) {
            console.error(error)
            alert('Error al calcular')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmarTodo = async () => {
        const validResults = resultados.filter(r => !r.error)
        if (validResults.length === 0) return

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
        } catch (error: any) {
            alert(error.message)
        } finally {
            setConfirmando(false)
        }
    }

    const handleGuardarTodoBorrador = async () => {
        setGuardandoBorrador(true)
        try {
            for (const result of resultados) {
                if (result.error) continue;
                await fetch('/api/liquidaciones/borrador', {
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
            }
            setBorradorCargado(true)
            alert('¡Borrador guardado correctamente!')
        } catch (error) {
            alert('Error al guardar borrador')
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
            const [newData] = await res.json()
            
            setResultados(prev => prev.map(r => {
                if (r.empleadoId === empleadoId) {
                    const adj = r.ajusteHorasExtras || 0;
                    
                    const nuevoDesglose = newData.desglosePorDia.map((newDia: any) => {
                        const oldDia = r.desglosePorDia.find((d: any) => d.fecha === newDia.fecha);
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

                    const currentHsExtrasBase = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.horasExtras || 0), 0);
                    const currentMontoExtrasBase = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.valorExtra || 0), 0);
                    const currentMontoFeriado = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.valorFeriado || 0), 0);
                    const currentSueldoBase = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.valorDiaBase || 0), 0);
                    
                    const adjMoney = Math.round(adj * newData.valorHoraExtra);
                    const totalMontoExtras = currentMontoExtrasBase + adjMoney;
                    const adicionalesOriginales = r.adicionales || [];
                    const montoExtrasItems = adicionalesOriginales.reduce((acc: number, item: any) => acc + item.montoCalculado, 0);
                    const diasTrabajados = nuevoDesglose.filter((d: any) => d.multiplicadorJornal > 0 || d.multiplicadorJornal === undefined).length;

                    return {
                        ...newData,
                        desglosePorDia: nuevoDesglose,
                        sueldoBase: currentSueldoBase,
                        horasExtras: currentHsExtrasBase,
                        ajusteHorasExtras: adj,
                        montoHorasExtras: totalMontoExtras,
                        montoHorasFeriado: currentMontoFeriado,
                        adicionales: adicionalesOriginales,
                        diasTrabajados: diasTrabajados,
                        totalNeto: currentSueldoBase + totalMontoExtras + currentMontoFeriado + montoExtrasItems + (newData.montoHorasPendientes || 0) - (newData.descuentoPrestamos || 0)
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
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setUpdatingStatusDate(null)
        }
    }

    const getDiaStatus = (dia: any) => {
        if (dia.motivoInasistencia === 'Enfermedad') {
            return 'ENFERMEDAD'
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
                const baseMontoExtras = r.desglosePorDia.reduce((acc: number, d: any) => acc + (d.valorExtra || 0), 0);
                const montoExtrasItems = (r.adicionales || []).reduce((acc: number, a: any) => acc + a.montoCalculado, 0);
                const totalMontoExtras = baseMontoExtras + Math.round(val * r.valorHoraExtra);
                
                return {
                    ...r,
                    ajusteHorasExtras: val,
                    montoHorasExtras: totalMontoExtras,
                    totalNeto: (r.sueldoBase || 0) + totalMontoExtras + (r.montoHorasFeriado || 0) + montoExtrasItems - (r.descuentoPrestamos || 0)
                }
            }
            return r;
        }))
        setBorradorCargado(false)
    }

    const handleMultiplicadorChange = (empleadoId: string, fecha: string, value: string) => {
        const mult = parseFloat(value);
        setResultados(prev => prev.map(r => {
            if (r.empleadoId === empleadoId) {
                const nuevoDesglose = r.desglosePorDia.map((dia: any) => {
                    if (dia.fecha === fecha) {
                        const nuevoValorDiaBase = Math.round(dia.jornalBase * mult);
                        
                        // Recalcular también el valor del feriado proporcional al multiplicador
                        let nuevoValorFeriado = dia.valorFeriado;
                        if (dia.esFeriado) {
                            nuevoValorFeriado = Math.round((dia.jornalBase * mult) * 0.5);
                        }

                        return {
                            ...dia,
                            multiplicadorJornal: mult,
                            valorDiaBase: nuevoValorDiaBase,
                            valorFeriado: nuevoValorFeriado,
                            totalDia: Math.round(nuevoValorDiaBase + dia.valorExtra + nuevoValorFeriado)
                        }
                    }
                    return dia;
                });

                const nuevoSueldoBase = nuevoDesglose.reduce((acc: number, d: any) => acc + d.valorDiaBase, 0);
                const nuevoDiasTrabajados = nuevoDesglose.filter((d: any) => d.multiplicadorJornal > 0).length;
                
                return {
                    ...r,
                    desglosePorDia: nuevoDesglose,
                    sueldoBase: nuevoSueldoBase,
                    diasTrabajados: nuevoDiasTrabajados,
                    totalNeto: nuevoSueldoBase + r.montoHorasExtras + r.montoHorasFeriado - r.descuentoPrestamos
                }
            }
            return r;
        }));
        setBorradorCargado(false);
    }

    const handleDailyExtrasChange = (empleadoId: string, fecha: string, value: string) => {
        const extraHs = parseFloat(value) || 0;
        setResultados(prev => prev.map(r => {
            if (r.empleadoId === empleadoId) {
                const nuevoDesglose = r.desglosePorDia.map((dia: any) => {
                    if (dia.fecha === fecha) {
                        const nuevoValorExtra = Math.round(extraHs * r.valorHoraExtra);
                        return {
                            ...dia,
                            horasExtras: extraHs,
                            valorExtra: nuevoValorExtra,
                            totalDia: Math.round(dia.valorDiaBase + nuevoValorExtra + dia.valorFeriado)
                        }
                    }
                    return dia;
                });

                const montoExtrasBase = nuevoDesglose.reduce((acc: number, d: any) => acc + d.valorExtra, 0);
                const montoExtrasAjuste = Math.round((r.ajusteHorasExtras || 0) * r.valorHoraExtra);
                const nuevoMontoExtras = montoExtrasBase + montoExtrasAjuste;
                const nuevasHorasExtrasTotales = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.horasExtras || 0), 0);
                
                return {
                    ...r,
                    desglosePorDia: nuevoDesglose,
                    horasExtras: nuevasHorasExtrasTotales,
                    montoHorasExtras: nuevoMontoExtras,
                    totalNeto: (r.sueldoBase || 0) + nuevoMontoExtras + (r.montoHorasFeriado || 0) + (r.adicionales || []).reduce((acc: number, a: any) => acc + a.montoCalculado, 0) - (r.descuentoPrestamos || 0)
                }
            }
            return r;
        }));
        setBorradorCargado(false);
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
                const montoAdicTotal = nuevosAdicionales.reduce((acc, a) => acc + a.montoCalculado, 0);
                return {
                    ...r,
                    adicionales: nuevosAdicionales,
                    totalNeto: (r.sueldoBase || 0) + (r.montoHorasExtras || 0) + (r.montoHorasFeriado || 0) + montoAdicTotal - (r.descuentoPrestamos || 0)
                }
            }
            return r;
        }));
        setBorradorCargado(false);
    }

    const handleRemoveAdicional = (empleadoId: string, index: number) => {
        setResultados(prev => prev.map(r => {
            if (r.empleadoId === empleadoId) {
                const nuevosAdicionales = r.adicionales.filter((_: any, i: number) => i !== index);
                const montoAdicTotal = nuevosAdicionales.reduce((acc: number, a: any) => acc + a.montoCalculado, 0);
                return {
                    ...r,
                    adicionales: nuevosAdicionales,
                    totalNeto: (r.sueldoBase || 0) + (r.montoHorasExtras || 0) + (r.montoHorasFeriado || 0) + montoAdicTotal - (r.descuentoPrestamos || 0)
                }
            }
            return r;
        }));
        setBorradorCargado(false);
    }

    const handleDeferHours = async (empleadoId: string, hours: string, monto: number) => {
        if (!hours || parseFloat(hours) <= 0) return;
        if (!confirm(`¿Deseas diferir ${hours}hs ($${monto.toLocaleString()}) para la liquidación del próximo sábado? Se descontarán de la liquidación actual.`)) return;

        try {
            const res = await fetch('/api/empleados/horas-extras-pendientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    cantidadHoras: hours,
                    montoCalculado: monto,
                    observaciones: 'Diferido desde liquidación semanal'
                })
            })
            if (res.ok) {
                // Descontar del ajuste manual actual
                setResultados(prev => prev.map(r => {
                    if (r.empleadoId === empleadoId) {
                        const currentAdj = r.ajusteHorasExtras || 0;
                        const newAdj = currentAdj - parseFloat(hours);
                        const valExtra = r.valorHoraExtra || 0;
                        const totalMontoExtras = r.desglosePorDia.reduce((acc: number, d: any) => acc + (d.valorExtra || 0), 0) + Math.round(newAdj * valExtra);
                        
                        return {
                            ...r,
                            ajusteHorasExtras: newAdj,
                            montoHorasExtras: totalMontoExtras,
                            totalNeto: (r.sueldoBase || 0) + totalMontoExtras + (r.montoHorasFeriado || 0) + (r.montoHorasPendientes || 0) + (r.adicionales || []).reduce((acc: any, a: any) => acc + a.montoCalculado, 0) - (r.descuentoPrestamos || 0)
                        }
                    }
                    return r;
                }));
                alert('Horas diferidas correctamente. Se han descontado del total actual.');
            }
        } catch (e) { console.error(e) }
    }

    const handleManualDebt = async (empleadoId: string, hours: string, monto: number) => {
        if (!hours || parseFloat(hours) <= 0) return;
        try {
            const res = await fetch('/api/empleados/horas-extras-pendientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    cantidadHoras: hours,
                    montoCalculado: monto,
                    observaciones: 'Carga manual de deuda anterior'
                })
            })
            if (res.ok) {
                // Recargar los datos del empleado para que se refleje la nueva deuda en el total
                await handleRecalcularEmpleado(empleadoId);
                alert('Deuda cargada y sumada a la liquidación actual.');
            }
        } catch (e) { console.error(e) }
    }

    const handleClearDebt = async (empleadoId: string) => {
        if (!confirm('¿Seguro que quieres borrar todas las horas adeudadas de este empleado?')) return;
        try {
            const res = await fetch(`/api/empleados/horas-extras-pendientes?empleadoId=${empleadoId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                await handleRecalcularEmpleado(empleadoId);
            }
        } catch (e) { console.error(e) }
    }

    // Convierte "HH:MM" o "HH:MM AM/PM" a minutos desde medianoche
    const parseTimeToMinutes = (timeStr: string): number | null => {
        if (!timeStr) return null
        // Formato 24h directo: "14:30"
        const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
        if (match24) return parseInt(match24[1]) * 60 + parseInt(match24[2])
        // Formato 12h: "02:30 PM"
        const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
        if (match12) {
            let h = parseInt(match12[1])
            const m = parseInt(match12[2])
            const ampm = match12[3].toUpperCase()
            if (ampm === 'PM' && h !== 12) h += 12
            if (ampm === 'AM' && h === 12) h = 0
            return h * 60 + m
        }
        return null
    }

    // Convierte minutos desde medianoche a "HH:MM AM/PM"
    const minutesToTimeDisplay = (mins: number): string => {
        const h24 = Math.floor(mins / 60) % 24
        const m = Math.round(mins % 60)
        const ampm = h24 >= 12 ? 'PM' : 'AM'
        const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
    }

    // Convierte "HH:MM" o "HH:MM AM/PM" a formato 24h "HH:MM" para <input type="time">
    const toTimeInputValue = (timeStr: string | null): string => {
        if (!timeStr) return ''
        const mins = parseTimeToMinutes(timeStr)
        if (mins === null) return ''
        const h = Math.floor(mins / 60)
        const m = Math.round(mins % 60)
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    const handleTimeChange = (empleadoId: string, fecha: string, field: 'entrada' | 'salida', value: string) => {
        if (!value) return
        setResultados(prev => prev.map(r => {
            if (r.empleadoId !== empleadoId) return r

            const nuevoDesglose = r.desglosePorDia.map((dia: any) => {
                if (dia.fecha !== fecha) return dia

                const newDisplay = minutesToTimeDisplay(parseInt(value.split(':')[0]) * 60 + parseInt(value.split(':')[1]))
                const updatedEntrada = field === 'entrada' ? newDisplay : dia.entrada
                const updatedSalida = field === 'salida' ? newDisplay : dia.salida

                // Recalcular horas trabajadas
                const entradaMins = parseTimeToMinutes(updatedEntrada)
                const salidaMins = parseTimeToMinutes(updatedSalida)

                let newHorasTrabajadas = dia.horasTrabajadas
                let newHorasExtras = dia.horasExtras
                const hsJornada = r.desglosePorDia.length > 0 ? (r.desglosePorDia[0].jornalBase > 0 ? (r.desglosePorDia[0].jornalBase / (r.valorHoraExtra / 2)) : 8) : 8
                // Usamos las horas de jornada del empleado que se guardaron
                const hsJornadaReal = r.horasNormales > 0 && r.diasTrabajados > 0 ? Math.round((r.horasNormales + r.horasExtras) / r.diasTrabajados) : 8

                if (entradaMins !== null && salidaMins !== null) {
                    let diffMins = salidaMins - entradaMins
                    if (diffMins < 0) diffMins += 24 * 60 // Cruce de medianoche
                    newHorasTrabajadas = parseFloat((diffMins / 60).toFixed(2))
                    
                    // Determinar jornada esperada desde el jornal
                    const valorHoraNormal = r.valorHoraExtra / 2
                    const jornadaEsperada = valorHoraNormal > 0 ? dia.jornalBase / valorHoraNormal : 8
                    newHorasExtras = Math.max(0, parseFloat((newHorasTrabajadas - jornadaEsperada).toFixed(2)))
                    // Redondear extras al 0.5 más cercano
                    newHorasExtras = Math.round(newHorasExtras * 2) / 2
                }

                const mult = dia.multiplicadorJornal
                const valorDiaBase = mult > 0 ? dia.jornalBase * mult : 0
                const valorExtra = Math.round(newHorasExtras * r.valorHoraExtra)
                let valorFeriado = dia.valorFeriado
                if (dia.esFeriado && newHorasTrabajadas > 0) {
                    const valorHoraNormal = r.valorHoraExtra / 2
                    const hsEfectivas = Math.max(newHorasTrabajadas, dia.jornalBase / (valorHoraNormal || 1))
                    valorFeriado = Math.round(hsEfectivas * valorHoraNormal * 0.5)
                }

                return {
                    ...dia,
                    entrada: updatedEntrada,
                    salida: updatedSalida,
                    horasTrabajadas: newHorasTrabajadas,
                    horasExtras: newHorasExtras,
                    valorExtra,
                    valorFeriado,
                    totalDia: Math.round(valorDiaBase + valorExtra + valorFeriado)
                }
            })

            const nuevoSueldoBase = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.valorDiaBase || 0), 0)
            const montoExtrasBase = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.valorExtra || 0), 0)
            const montoFeriado = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.valorFeriado || 0), 0)
            const montoExtrasAjuste = Math.round((r.ajusteHorasExtras || 0) * r.valorHoraExtra)
            const nuevoMontoExtras = montoExtrasBase + montoExtrasAjuste
            const nuevasHsExtras = nuevoDesglose.reduce((acc: number, d: any) => acc + (d.horasExtras || 0), 0)
            const montoAdic = (r.adicionales || []).reduce((acc: number, a: any) => acc + a.montoCalculado, 0)

            return {
                ...r,
                desglosePorDia: nuevoDesglose,
                sueldoBase: nuevoSueldoBase,
                horasExtras: nuevasHsExtras,
                montoHorasExtras: nuevoMontoExtras,
                montoHorasFeriado: montoFeriado,
                totalNeto: nuevoSueldoBase + nuevoMontoExtras + montoFeriado + montoAdic + (r.montoHorasPendientes || 0) - (r.descuentoPrestamos || 0)
            }
        }))
        setBorradorCargado(false)
    }

    const totalGeneral = resultados.reduce((acc, r) => acc + (r.totalNeto || 0), 0)

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }}>
                <div className="modal-header">
                    <div>
                        <h2>💰 Liquidación Semanal Automatizada</h2>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>Basado en fichadas del reloj y reglas de negocio configuradas.</p>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body" style={{ overflowY: 'auto' }}>
                    <div className="filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Desde (Lunes)</label>
                            <input type="date" className="form-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Hasta (Domingo)</label>
                            <input type="date" className="form-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Caja de Egreso</label>
                            <select className="form-select" value={cajaId} onChange={e => setCajaId(e.target.value)}>
                                <option value="caja_chica">Caja Chica</option>
                                <option value="mercado_pago">Mercado Pago (MP)</option>
                                <option value="caja_madre">Caja Madre</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn btn-primary btn-block" onClick={handleCalcular} disabled={loading}>
                                {loading ? 'Calculando...' : '🔄 Calcular Sueldos'}
                            </button>
                        </div>
                    </div>

                    {empleadosExcluidos.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--color-info-bg)', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                            <span>ℹ️</span>
                            <div style={{ color: 'var(--color-info)', fontWeight: 500 }}>
                                <strong>{empleadosExcluidos.length} empleados</strong> ya tienen una liquidación finalizada en este periodo y fueron omitidos: 
                                <span style={{ marginLeft: 'var(--space-2)', fontWeight: 400, fontStyle: 'italic' }}>
                                    {empleadosExcluidos.map(e => `${e.nombre} ${e.apellido || ''}`).join(', ')}
                                </span>
                            </div>
                        </div>
                    )}

                    {resultados.length > 0 ? (
                        <div className="table-container shadow-sm" style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            <table className="table table-sm">
                                <thead style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                    <tr>
                                        <th style={{ width: '30px' }}></th>
                                        <th>Empleado</th>
                                        <th style={{ textAlign: 'center' }}>Días</th>
                                        <th style={{ textAlign: 'right' }}>Sueldo Base</th>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Ajuste (hs)</th>
                                        <th style={{ textAlign: 'right' }}>Hs. Extras</th>
                                        <th style={{ textAlign: 'right' }}>Recargo Fer.</th>
                                        <th style={{ textAlign: 'right' }}>Deducciones</th>
                                        <th style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>Neto a Pagar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultados.map((r) => (
                                        <Fragment key={r.empleadoId}>
                                            <tr onClick={() => !r.error && setExpandedRow(expandedRow === r.empleadoId ? null : r.empleadoId)} style={{ cursor: r.error ? 'default' : 'pointer', backgroundColor: expandedRow === r.empleadoId ? 'var(--color-info-bg)' : 'transparent', opacity: r.error ? 0.7 : 1 }}>
                                                <td>{!r.error && (expandedRow === r.empleadoId ? '▼' : '▶')}</td>
                                                <td style={{ fontWeight: 600 }}>
                                                    {r.empleadoNombre || empleados.find(e => e.id === r.empleadoId)?.nombre || 'Empleado'}
                                                    {r.error && <span className="badge badge-danger" style={{ marginLeft: 'var(--space-2)', fontSize: '10px' }}>ERROR</span>}
                                                    {r.montoHorasPendientes > 0 && (
                                                        <div style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            ⚠️ HS ADEUDADAS: {r.horasPendientes}hs (${r.montoHorasPendientes.toLocaleString()})
                                                            <button 
                                                                className="btn btn-ghost" 
                                                                style={{ padding: 0, height: '14px', width: '14px', color: 'var(--color-danger)', fontSize: '10px' }}
                                                                title="Borrar deuda"
                                                                onClick={(e) => { e.stopPropagation(); handleClearDebt(r.empleadoId); }}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                {r.error ? (
                                                    <td colSpan={6} style={{ color: 'var(--color-danger)', fontSize: '12px', fontStyle: 'italic' }}>
                                                        Error: {r.error}
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td style={{ textAlign: 'center' }}>{r.diasTrabajados}</td>
                                                        <td style={{ textAlign: 'right' }}>${(r.sueldoBase || 0).toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                step="0.5" 
                                                                className="form-input" 
                                                                style={{ padding: '2px 5px', fontSize: '11px', textAlign: 'center', height: '24px' }} 
                                                                value={r.ajusteHorasExtras || ''} 
                                                                onChange={e => handleAjusteChange(r.empleadoId, e.target.value)} 
                                                                onClick={e => e.stopPropagation()}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                                                            <span style={{ fontSize: '10px', display: 'block' }}>
                                                                ({(r.horasExtras || 0) + (r.ajusteHorasExtras || 0)}h)
                                                                {r.ajusteHorasExtras !== 0 && <span style={{ color: r.ajusteHorasExtras > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}> {r.ajusteHorasExtras > 0 ? '+' : ''}{r.ajusteHorasExtras}</span>}
                                                            </span>
                                                            ${(r.montoHorasExtras || 0).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {(r.montoHorasFeriado || 0) > 0 && <span className="badge badge-warning" style={{ fontSize: '9px' }}>FER</span>}
                                                            ${(r.montoHorasFeriado || 0).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                                                            {(r.descuentoPrestamos || 0) > 0 && <span style={{ fontSize: '10px' }}>Préstamos</span>}
                                                            -${(r.descuentoPrestamos || 0).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 800 }}>${(r.totalNeto || 0).toLocaleString()}</td>
                                                    </>
                                                )}
                                            </tr>
                                            {expandedRow === r.empleadoId && (
                                                <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                                    <td colSpan={8} style={{ padding: 'var(--space-4)' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)' }}>
                                                            {r.desglosePorDia.map((dia: DiaTrabajado) => (
                                                                <div key={dia.fecha} style={{ backgroundColor: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: `1px solid ${dia.esFeriado ? 'var(--color-warning)' : 'var(--color-gray-200)'}`, fontSize: '11px', opacity: dia.horasTrabajadas > 0 ? 1 : 0.5 }}>
                                                                    <div style={{ fontWeight: 700, borderBottom: '1px solid var(--color-gray-100)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span>{dia.diaSemana} {dia.fecha.split('-')[2]}</span>
                                                                        {dia.esFeriado && <span style={{ color: 'var(--color-warning)' }}>🚩</span>}
                                                                        {dia.esJustificado && !dia.tipoInasistencia && <span className="badge badge-success" style={{ fontSize: '8px', padding: '1px 3px' }}>MANUAL</span>}
                                                                        {dia.tipoInasistencia && (
                                                                            <span className={`badge badge-${dia.tipoInasistencia.includes('INJUSTIFICADA') ? 'danger' : 'info'}`} style={{ fontSize: '7px', padding: '1px 3px' }}>
                                                                                {dia.tipoInasistencia.replace(/_/g, ' ')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <div>
                                                                             <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                                <input 
                                                                                    type="time" 
                                                                                    className="form-input"
                                                                                    style={{ width: '52px', padding: '0px 1px', fontSize: '9px', height: '18px', textAlign: 'center', border: '1px solid var(--color-gray-200)', borderRadius: '2px' }}
                                                                                    value={toTimeInputValue(dia.entrada)}
                                                                                    onChange={e => handleTimeChange(r.empleadoId, dia.fecha, 'entrada', e.target.value)}
                                                                                    title="Hora de entrada"
                                                                                />
                                                                                <span style={{ fontSize: '9px', color: 'var(--color-gray-400)' }}>a</span>
                                                                                <input 
                                                                                    type="time" 
                                                                                    className="form-input"
                                                                                    style={{ width: '52px', padding: '0px 1px', fontSize: '9px', height: '18px', textAlign: 'center', border: '1px solid var(--color-gray-200)', borderRadius: '2px' }}
                                                                                    value={toTimeInputValue(dia.salida)}
                                                                                    onChange={e => handleTimeChange(r.empleadoId, dia.fecha, 'salida', e.target.value)}
                                                                                    title="Hora de salida"
                                                                                />
                                                                             </div>
                                                                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                <span style={{ color: 'var(--color-gray-500)' }}>HS: {dia.horasTrabajadas}</span>
                                                                                <input 
                                                                                    type="number" 
                                                                                    step="0.5" 
                                                                                    className="form-input" 
                                                                                    style={{ width: '40px', padding: '0px 2px', fontSize: '10px', height: '18px', textAlign: 'center', color: 'var(--color-success)', fontWeight: 600 }}
                                                                                    value={dia.horasExtras}
                                                                                    onChange={e => handleDailyExtrasChange(r.empleadoId, dia.fecha, e.target.value)}
                                                                                    title="Editar horas extra de este día"
                                                                                />
                                                                             </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            {dia.horasTrabajadas === 0 && (
                                                                                <button className="btn btn-ghost" title="Justificar día completo" onClick={() => handleJustificar(r.empleadoId, dia.fecha)} style={{ padding: '2px', height: 'auto', fontSize: '14px', color: 'var(--color-success)' }}>🟢</button>
                                                                            )}
                                                                            {dia.esJustificado && (
                                                                                <button className="btn btn-ghost" title="Quitar justificación" onClick={() => handleQuitarJustificacion(r.empleadoId, dia.fecha)} style={{ padding: '2px', height: 'auto', fontSize: '14px', color: 'var(--color-danger)' }}>🔴</button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ marginTop: '4px', borderTop: '1px dashed var(--color-gray-200)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span style={{ fontSize: '9px', color: 'var(--color-gray-400)' }}>Estado:</span>
                                                                            {updatingStatusDate === `${r.empleadoId}-${dia.fecha}` ? (
                                                                                <span style={{ fontSize: '8px', color: 'var(--color-gray-400)' }}>Guardando...</span>
                                                                            ) : (
                                                                                <select
                                                                                    value={getDiaStatus(dia)}
                                                                                    onChange={(e) => handleStatusChange(r.empleadoId, dia.fecha, e.target.value)}
                                                                                    className="form-select"
                                                                                    style={{ padding: '0px 2px', fontSize: '9px', height: '16px', width: '80px', border: '1px solid var(--color-gray-200)', borderRadius: '2px', cursor: 'pointer' }}
                                                                                >
                                                                                    <option value="TRABAJO">🟢 Trabajó</option>
                                                                                    <option value="FRANCO">⚪ Franco</option>
                                                                                    <option value="FERIADO">🚩 Feriado</option>
                                                                                    <option value="ENFERMEDAD">🟣 Enfermedad</option>
                                                                                    <option value="SIN_AVISO">🔴 Sin Aviso</option>
                                                                                    <option value="CON_AVISO">🟠 Con Aviso</option>
                                                                                </select>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontWeight: 600, marginTop: '4px', textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <select 
                                                                            className="form-select" 
                                                                            style={{ padding: '0px 2px', fontSize: '9px', height: '18px', width: '70px', border: '1px solid var(--color-gray-200)' }}
                                                                            value={dia.multiplicadorJornal}
                                                                            onChange={e => handleMultiplicadorChange(r.empleadoId, dia.fecha, e.target.value)}
                                                                        >
                                                                            <option value="1">Día Comp.</option>
                                                                            <option value="0.5">Medio Día</option>
                                                                            <option value="0">No Pagar</option>
                                                                        </select>
                                                                        <span>${dia.totalDia.toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Sección de Conceptos Adicionales */}
                                                        <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px dashed var(--color-gray-300)' }}>
                                                            <h4 style={{ fontSize: '12px', marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                                ➕ Conceptos Adicionales (Otros Pagos / Deudas)
                                                            </h4>
                                                            
                                                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                                {(r.adicionales || []).map((ad: any, idx: number) => (
                                                                    <div key={idx} style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-primary)', padding: '4px 8px', borderRadius: 'var(--radius-md)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                                        <strong>{ad.nombre}:</strong> ${ad.montoCalculado.toLocaleString()}
                                                                        <button onClick={() => handleRemoveAdicional(r.empleadoId, idx)} style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0 }}>✕</button>
                                                                    </div>
                                                                ))}

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-gray-100)', padding: '2px 4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                                                                    <select id={`concepto-${r.empleadoId}`} className="form-select" style={{ height: '22px', fontSize: '10px', padding: '0 4px', width: '150px' }}>
                                                                        <option value="">Seleccionar concepto...</option>
                                                                        {conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                                                    </select>
                                                                    <input id={`monto-${r.empleadoId}`} type="number" className="form-input" placeholder="Monto" style={{ height: '22px', fontSize: '10px', width: '80px', padding: '0 4px' }} />
                                                                    <button 
                                                                        className="btn btn-primary" 
                                                                        style={{ height: '22px', padding: '0 8px', fontSize: '10px' }}
                                                                        onClick={() => {
                                                                            const cId = (document.getElementById(`concepto-${r.empleadoId}`) as HTMLSelectElement).value;
                                                                            const m = parseFloat((document.getElementById(`monto-${r.empleadoId}`) as HTMLInputElement).value);
                                                                            handleAddAdicional(r.empleadoId, cId, m);
                                                                            (document.getElementById(`monto-${r.empleadoId}`) as HTMLInputElement).value = '';
                                                                        }}
                                                                    >
                                                                        Añadir
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Gestión de Horas Pendientes / Adeudadas */}
                                                        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                                            {/* Diferir a Futuro */}
                                                            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-gray-300)' }}>
                                                                <div style={{ fontSize: '11px', color: 'var(--color-gray-600)', fontWeight: 600, marginBottom: '8px' }}>
                                                                    ⏳ DIFERIR PARA EL PRÓXIMO SÁBADO
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <input 
                                                                        type="number" 
                                                                        id={`defer-hs-${r.empleadoId}`}
                                                                        className="form-input" 
                                                                        placeholder="Cant. HS"
                                                                        style={{ width: '80px', height: '24px', fontSize: '11px' }}
                                                                    />
                                                                    <button 
                                                                        className="btn btn-primary" 
                                                                        style={{ height: '24px', fontSize: '10px', padding: '0 10px', backgroundColor: 'var(--color-gray-600)', borderColor: 'var(--color-gray-600)' }}
                                                                        onClick={() => {
                                                                            const hsInput = document.getElementById(`defer-hs-${r.empleadoId}`) as HTMLInputElement;
                                                                            const hs = hsInput.value;
                                                                            const monto = Math.round(parseFloat(hs) * r.valorHoraExtra);
                                                                            handleDeferHours(r.empleadoId, hs, monto);
                                                                            hsInput.value = '';
                                                                        }}
                                                                    >
                                                                        Diferir
                                                                    </button>
                                                                </div>
                                                                <p style={{ fontSize: '9px', marginTop: '4px', color: 'var(--color-gray-400)' }}>Se descuentan de hoy y se pasan al sábado que viene.</p>
                                                            </div>

                                                            {/* Cargar Deuda Pasada */}
                                                            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-primary-bg)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-primary)' }}>
                                                                <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '8px' }}>
                                                                    ➕ CARGAR DEUDA DE SEMANA ANTERIOR
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <input 
                                                                        type="number" 
                                                                        id={`manual-debt-hs-${r.empleadoId}`}
                                                                        className="form-input" 
                                                                        placeholder="Cant. HS"
                                                                        style={{ width: '80px', height: '24px', fontSize: '11px' }}
                                                                    />
                                                                    <button 
                                                                        className="btn btn-primary" 
                                                                        style={{ height: '24px', fontSize: '10px', padding: '0 10px' }}
                                                                        onClick={() => {
                                                                            const hsInput = document.getElementById(`manual-debt-hs-${r.empleadoId}`) as HTMLInputElement;
                                                                            const hs = hsInput.value;
                                                                            const monto = Math.round(parseFloat(hs) * r.valorHoraExtra);
                                                                            handleManualDebt(r.empleadoId, hs, monto);
                                                                            hsInput.value = '';
                                                                        }}
                                                                    >
                                                                        Sumar a este Sábado
                                                                    </button>
                                                                </div>
                                                                <p style={{ fontSize: '9px', marginTop: '4px', color: 'var(--color-primary)' }}>Se suman directamente al total de hoy.</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>

                                <tfoot style={{ backgroundColor: 'var(--color-gray-100)', fontWeight: 'bold' }}>
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'right' }}>TOTAL A PAGAR:</td>
                                        <td style={{ textAlign: 'right', fontSize: 'var(--text-lg)', color: 'var(--color-primary)' }}>${totalGeneral.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-gray-400)' }}>
                            <p style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📊</p>
                            <p>Presiona "Calcular Sueldos" para generar la previsualización del periodo.</p>
                        </div>
                    )}
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                        {resultados.length > 0 && (
                            <button className="btn btn-outline" onClick={handleGuardarTodoBorrador} disabled={guardandoBorrador || confirmando}>
                                {guardandoBorrador ? 'Guardando...' : borradorCargado ? '✅ Borrador al día' : '💾 Guardar Borrador'}
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-outline" onClick={onClose} disabled={confirmando}>Cerrar</button>
                        <button className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', minWidth: '200px' }} onClick={handleConfirmarTodo} disabled={resultados.length === 0 || confirmando}>
                            {confirmando ? 'Procesando...' : `🚀 Finalizar y Liquidar (${resultados.length})`}
                        </button>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
                .modal { background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
