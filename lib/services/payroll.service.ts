import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'
import { CajaService } from '@/lib/services/caja.service'
import { calcularDiaSemanal } from '@/lib/payroll/calculoDiaSemanal'
import { reconstruirLiquidacionCalculada, validarMontoAdicional } from '@/lib/payroll/validacionLiquidacion'
import { fechaClaveRRHH, instanteRRHH, rangoDiasRRHH } from '@/lib/rrhh/fechas'
import { agruparFichadasPorDia, calcularResumenDia } from '@/utils/horas'
import { fechasDeRangoVacaciones, periodoLaboralCubiertoPorVacaciones, rangoVacacionesDesdeDesglose } from '@/lib/payroll/vacaciones'
import { seleccionarCuotasVencidasPorPrestamo } from '@/lib/payroll/prestamos'
import {
    normalizarRangoLiquidacion,
    rangoHistoricoLiquidacion,
    rangosLiquidacionSeSuperponen,
    validarLiquidacionAnulable,
    validarMotivoAnulacionLiquidacion,
} from '@/lib/payroll/liquidaciones'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface DiaTrabajado {
    fecha: string
    diaSemana: string
    esFeriado: boolean
    nombreFeriado?: string
    horasTrabajadas: number
    horasExtras: number
    entrada: string | null
    salida: string | null
    jornalBase: number
    valorDiaBase: number
    multiplicadorJornal: number // 1.0 = Día completo, 0.5 = Medio día, etc.
    valorExtra: number
    valorFeriado: number
    totalDia: number
    esJustificado: boolean
    tipoInasistencia?: string
    motivoInasistencia?: string | null
}

export interface ResumenSemanal {
    empleadoId: string
    empleadoNombre: string
    periodo: string
    diasTrabajados: number
    horasNormales: number
    horasExtras: number
    horasFeriado: number
    sueldoBase: number
    valorHoraExtra: number
    horasJornada: number
    montoHorasExtras: number
    montoHorasFeriado: number
    descuentoPrestamos: number
    horasPendientes: number
    montoHorasPendientes: number
    totalNeto: number
    diasVacaciones: number
    excluirLiquidacionSemanal: boolean
    desglosePorDia: DiaTrabajado[]
}

export interface LiquidacionInput {
    empleadoId: string
    periodo: string
    fechaInicio: string
    fechaFin: string
    cajaId?: string
    concepto?: string
    manualData?: any
    calculatedData?: any
    aplicarCuotasPrestamo?: boolean
    tipo?: string
    adicionales?: { conceptoSalarialId: string; montoCalculado: number; detalle?: string }[]
    estadosDiarios?: Array<{
        fecha: Date
        tipo: string
        motivo?: string
        observaciones?: string
    }>
}

type ClienteLiquidaciones = {
    liquidacionSueldo: typeof prisma.liquidacionSueldo
}

async function encontrarLiquidacionDuplicada(
    cliente: ClienteLiquidaciones,
    input: {
        empleadoId: string
        periodo: string
        tipo: string
        desde: string
        hasta: string
    },
) {
    if (!['NORMAL', 'VACACIONES', 'SAC'].includes(input.tipo)) {
        return cliente.liquidacionSueldo.findFirst({
            where: { empleadoId: input.empleadoId, periodo: input.periodo, estado: 'pagado' },
            select: { id: true, periodo: true },
        })
    }

    const conRango = await cliente.liquidacionSueldo.findFirst({
        where: {
            empleadoId: input.empleadoId,
            tipo: input.tipo,
            estado: 'pagado',
            periodoDesde: { lte: instanteRRHH(input.hasta) },
            periodoHasta: { gte: instanteRRHH(input.desde) },
        },
        select: { id: true, periodo: true },
    })
    if (conRango) return conRango

    const historicas = await cliente.liquidacionSueldo.findMany({
        where: {
            empleadoId: input.empleadoId,
            tipo: input.tipo,
            estado: 'pagado',
            periodoDesde: null,
            periodoHasta: null,
        },
        select: { id: true, periodo: true, desglose: true },
    })
    const rangoNuevo = { desde: input.desde, hasta: input.hasta }
    return historicas.find(liquidacion => {
        const rangoHistorico = rangoHistoricoLiquidacion(liquidacion.periodo, liquidacion.desglose)
        return rangoHistorico ? rangosLiquidacionSeSuperponen(rangoNuevo, rangoHistorico) : false
    }) || null
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export class PayrollService {

    // ─── Cálculo de Sueldo Semanal ───────────────────────────────────────────
    /**
     * Calcula el sueldo semanal de un empleado para un período dado.
     * Incluye: jornal diario, horas extras, feriados, descuento de préstamos.
     * (Refactor del código original de lib/payroll/calculoSueldoSemanal.ts)
     */
    static async calcularSueldoSemanal(
        empleadoId: string,
        fechaInicio: string,
        fechaFin: string
    ): Promise<ResumenSemanal> {
        const rangoPeriodo = rangoDiasRRHH(fechaInicio, fechaFin)
        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            include: {
                rolRel: true,
                fichadas: {
                    where: {
                        fechaHora: {
                            gte: rangoPeriodo.gte,
                            lt: rangoPeriodo.lt
                        }
                    },
                    include: { tipoLicencia: true }
                },
                inasistencias: {
                    where: {
                        fecha: {
                            gte: rangoPeriodo.gte,
                            lt: rangoPeriodo.lt
                        }
                    }
                },
                liquidaciones: {
                    where: { tipo: 'VACACIONES', estado: { not: 'anulado' } },
                    select: { desglose: true }
                }
            }
        })

        if (!empleado) throw new Error('Empleado no encontrado')

        // Vacaciones nuevas: estado diario. Vacaciones históricas: rango guardado
        // dentro del comprobante, para no perder compatibilidad con lo ya liquidado.
        const fechasVacaciones = new Set(
            empleado.inasistencias
                .filter(inasistencia => inasistencia.tipo === 'VACACIONES')
                .map(inasistencia => fechaClaveRRHH(inasistencia.fecha))
        )
        empleado.liquidaciones.forEach(liquidacion => {
            const rango = rangoVacacionesDesdeDesglose(liquidacion.desglose)
            if (!rango) return
            fechasDeRangoVacaciones(rango.desde, rango.hasta).forEach(fecha => fechasVacaciones.add(fecha))
        })

        // 1. Obtener feriados en el periodo
        const feriados = await prisma.feriado.findMany({
            where: {
                fecha: {
                    gte: rangoPeriodo.gte,
                    lt: rangoPeriodo.lt
                }
            }
        })

        const feriadosMap: Record<string, string> = {}
        feriados.forEach(f => {
            const fStr = fechaClaveRRHH(f.fecha)
            feriadosMap[fStr] = f.nombre
        })

        // 2. Determinar Jornal DIARIO y Valor Hora
        let jornalBase = 0
        let montoBase = 0
        let cicloStr = 'SEMANAL'

        // Cascada de prioridad: 1. Jornal específico del empleado; 2. Jornal del Rol; 3. Sueldo Base Mensual
        if (empleado.jornal > 0) {
            montoBase = empleado.jornal
            cicloStr = empleado.cicloPago || 'SEMANAL'
        } else if (empleado.rolRel?.jornal) {
            montoBase = empleado.rolRel.jornal
            cicloStr = (empleado.rolRel as any).cicloPago || 'SEMANAL'
        } else if (empleado.sueldoBaseMensual > 0) {
            montoBase = empleado.sueldoBaseMensual
            cicloStr = 'MENSUAL'
        }

        if (cicloStr === 'DIARIO') {
            jornalBase = montoBase
        } else if (cicloStr === 'MENSUAL') {
            jornalBase = montoBase / 30
        } else {
            // SEMANAL: se aproxima a 6 días laborales
            jornalBase = montoBase / 6
        }

        const hsJornada = (empleado.horasTrabajoDiarias || 8)
        let valorHora = hsJornada > 0 ? jornalBase / hsJornada : 0

        // Prioridad para valorHoraNormal (si está configurado manualmente)
        if (empleado.valorHoraNormal && empleado.valorHoraNormal > 0) {
            valorHora = empleado.valorHoraNormal
        }

        // Prioridad para valorHoraExtra
        let valorHoraExtra = valorHora * 2 // Default: doble
        if (empleado.valorHoraExtra && empleado.valorHoraExtra > 0) {
            valorHoraExtra = empleado.valorHoraExtra
        } else if (empleado.rolRel?.valorHoraExtra && empleado.rolRel.valorHoraExtra > 0) {
            valorHoraExtra = empleado.rolRel.valorHoraExtra
        }

        // 3. Procesar Fichadas
        const fichadas = empleado.fichadas
        const gruposPorDia = agruparFichadasPorDia(fichadas)

        // Generar rango de fechas
        const desglosePorDia: DiaTrabajado[] = []
        const [startYear, startMonth, startDay] = fechaInicio.split('-').map(Number)
        const [endYear, endMonth, endDay] = fechaFin.split('-').map(Number)

        let current = new Date(startYear, startMonth - 1, startDay)
        const end = new Date(endYear, endMonth - 1, endDay)

        const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

        while (current <= end) {
            const year = current.getFullYear()
            const month = String(current.getMonth() + 1).padStart(2, '0')
            const day = String(current.getDate()).padStart(2, '0')
            const fechaStr = `${year}-${month}-${day}`
            const marcasRaw = gruposPorDia[fechaStr] || []

            const marcas = marcasRaw

            const resumen = calcularResumenDia(marcas, hsJornada)

            const esFeriado = !!feriadosMap[fechaStr]
            
            // 3.1 Verificar Inasistencias registradas
            const inasistencia = empleado.inasistencias.find(i => 
                fechaClaveRRHH(i.fecha) === fechaStr
            )
            const esVacaciones = fechasVacaciones.has(fechaStr)
            const tipoInasistencia = esVacaciones ? 'VACACIONES' : inasistencia?.tipo

            const calculoDia = calcularDiaSemanal({
                horasTrabajadas: resumen.horasTrabajadas,
                horasExtras: resumen.horasExtras,
                horasJornada: hsJornada,
                jornalBase,
                valorHora,
                valorHoraExtra,
                tieneMarcas: marcas.length > 0,
                esFeriado,
                tipoInasistencia,
            })

            const primerEntrada = marcas.find((m: any) => m.tipo === 'entrada')?.fechaHora
            const ultimaSalida = [...marcas].reverse().find((m: any) => m.tipo === 'salida')?.fechaHora

            desglosePorDia.push({
                fecha: fechaStr,
                diaSemana: nombresDias[current.getDay()],
                esFeriado,
                nombreFeriado: feriadosMap[fechaStr],
                horasTrabajadas: resumen.horasTrabajadas,
                horasExtras: calculoDia.horasExtras,
                entrada: primerEntrada ? new Date(primerEntrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                salida: ultimaSalida ? new Date(ultimaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                jornalBase: Math.round(jornalBase),
                valorDiaBase: Math.round(calculoDia.valorDiaBase),
                multiplicadorJornal: calculoDia.multiplicadorJornal,
                valorExtra: Math.round(calculoDia.valorExtra),
                valorFeriado: Math.round(calculoDia.valorFeriado),
                totalDia: Math.round(calculoDia.totalDia),
                esJustificado: esVacaciones || marcas.some((m: any) => m.origen === 'justificada') || (!!inasistencia && inasistencia.tipo.startsWith('JUSTIFICADA')),
                tipoInasistencia,
                motivoInasistencia: esVacaciones ? 'Vacaciones' : inasistencia?.motivo || null
            })

            current.setDate(current.getDate() + 1)
        }

        // 4. Buscar Préstamos/Cuotas del período
        const todasPendientes = await prisma.cuotaPrestamo.findMany({
            where: {
                prestamo: { empleadoId },
                estado: 'pendiente',
                liquidacionId: null,
                fechaVencimiento: { lt: rangoDiasRRHH(fechaInicio, fechaFin).lt }
            },
            orderBy: [
                { fechaVencimiento: 'asc' },
                { numeroCuota: 'asc' },
            ]
        })

        // Como máximo una cuota vencida por préstamo en cada liquidación.
        const cuotasADescontar = seleccionarCuotasVencidasPorPrestamo(
            todasPendientes,
            rangoDiasRRHH(fechaInicio, fechaFin).lt,
        )
        const descuentoPrestamos = cuotasADescontar.reduce((acc, cuota) => acc + cuota.monto, 0)

        // 5. Consolidar Resumen
        const diasTrabajados = desglosePorDia.filter(d => d.horasTrabajadas > 0).length
        const sueldoBase = desglosePorDia.reduce((acc, d) => acc + d.valorDiaBase, 0)
        const montoHorasExtras = desglosePorDia.reduce((acc, d) => acc + d.valorExtra, 0)
        const montoHorasFeriado = desglosePorDia.reduce((acc, d) => acc + d.valorFeriado, 0)
        const horasNormales = desglosePorDia.reduce((acc, d) => acc + (d.horasTrabajadas - d.horasExtras), 0)
        const horasExtrasTotales = desglosePorDia.reduce((acc, d) => acc + d.horasExtras, 0)
        const horasFeriadoTotales = desglosePorDia.reduce((acc, d) => acc + (d.esFeriado ? d.horasTrabajadas : 0), 0)

        // Las deudas de horas extras se pagan desde su módulo independiente y
        // nunca se incorporan a la liquidación de la semana en curso.
        const totalNeto = sueldoBase + montoHorasExtras + montoHorasFeriado - descuentoPrestamos
        const diasVacaciones = desglosePorDia.filter(dia => dia.tipoInasistencia === 'VACACIONES').length
        const excluirLiquidacionSemanal = periodoLaboralCubiertoPorVacaciones(
            fechaInicio,
            fechaFin,
            empleado.diasTrabajoSemana,
            fechasVacaciones,
        ) && desglosePorDia.every(dia => dia.horasTrabajadas <= 0)

        return {
            empleadoId: empleado.id,
            empleadoNombre: `${empleado.nombre} ${empleado.apellido || ''}`.trim(),
            periodo: `${fechaInicio} a ${fechaFin}`,
            diasTrabajados,
            horasNormales: parseFloat(horasNormales.toFixed(2)),
            horasExtras: horasExtrasTotales,
            horasFeriado: parseFloat(horasFeriadoTotales.toFixed(2)),
            sueldoBase,
            valorHoraExtra,
            horasJornada: hsJornada,
            montoHorasExtras,
            montoHorasFeriado,
            descuentoPrestamos,
            horasPendientes: 0,
            montoHorasPendientes: 0,
            totalNeto,
            diasVacaciones,
            excluirLiquidacionSemanal,
            desglosePorDia
        }
    }

    // ─── Ejecutar Liquidación ────────────────────────────────────────────────
    /**
     * Crea la liquidación, marca cuotas de préstamos y registra en caja.
     * Soporta 3 modos: automático (fichadas), calculado (WeeklyPayroll), manual (Express).
     */
    static async ejecutarLiquidacion(input: LiquidacionInput) {
        const { empleadoId, periodo, fechaInicio, fechaFin, cajaId, concepto, manualData, calculatedData, aplicarCuotasPrestamo = false, adicionales, tipo, estadosDiarios } = input

        if (!empleadoId || !periodo) {
            throw new Error('Faltan datos obligatorios')
        }

        if (!fechaInicio || !fechaFin) {
            throw new Error('Faltan datos para la liquidación')
        }

        const rangoCivil = normalizarRangoLiquidacion(fechaInicio, fechaFin)
        const tipoLiquidacion = tipo || 'NORMAL'

        // Salida rápida; la misma validación se repite dentro del bloqueo
        // transaccional para evitar pagos simultáneos del mismo período.
        const existente = await encontrarLiquidacionDuplicada(prisma, {
            empleadoId,
            periodo,
            tipo: tipoLiquidacion,
            ...rangoCivil,
        })
        if (existente) {
            throw new Error(`El empleado ya tiene una liquidación pagada que se superpone con ${periodo}: ${existente.periodo}.`)
        }

        const rangoPeriodo = rangoDiasRRHH(rangoCivil.desde, rangoCivil.hasta)
        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            include: {
                fichadas: {
                    where: {
                        fechaHora: { gte: rangoPeriodo.gte, lt: rangoPeriodo.lt }
                    },
                    orderBy: { fechaHora: 'asc' }
                },
                prestamos: {
                    include: {
                        cuotas: {
                            where: {
                                estado: 'pendiente',
                                liquidacionId: null,
                                fechaVencimiento: { lt: rangoPeriodo.lt },
                            },
                            orderBy: [
                                { fechaVencimiento: 'asc' },
                                { numeroCuota: 'asc' },
                            ]
                        }
                    }
                },
                rolRel: true
            }
        })

        if (!empleado) throw new Error('Empleado no encontrado')

        if (calculatedData) {
            const estadoActual = await PayrollService.calcularSueldoSemanal(empleadoId, fechaInicio, fechaFin)
            if (estadoActual.excluirLiquidacionSemanal) {
                throw new Error('El empleado está de vacaciones durante toda su semana laboral y no corresponde generar una liquidación semanal.')
            }
        }

        let sueldoProporcional = 0
        let horasNormales = 0
        let montoHsNorm = 0
        let horasExtras = 0
        let montoHsExtra = 0
        let horasFeriado = 0
        let montoHsFeriado = 0
        let deduccionCuotas = 0
        let diasTrabajados = 0
        let ajusteHorasExtras = 0

        if (manualData) {
            // Liquidación Express / Manual
            sueldoProporcional = manualData.sueldoBase || 0
            horasExtras = manualData.horasExtras || 0
            montoHsExtra = manualData.montoHsExtras || 0
            // Un descuento de préstamo nunca se acepta como monto libre. En las
            // liquidaciones manuales sólo puede provenir de cuotas reales que
            // el servidor vinculará al recibo generado.
            deduccionCuotas = aplicarCuotasPrestamo
                ? empleado.prestamos.reduce((total, prestamo) => total + (prestamo.cuotas[0]?.monto || 0), 0)
                : 0
            diasTrabajados = manualData.diasTrabajados || 0
        } else if (calculatedData) {
            // Reconstruir los importes desde el desglose. Los totales enviados por
            // la pantalla son informativos y no constituyen una fuente confiable.
            let montoBaseServidor = empleado.sueldoBaseMensual
            let cicloServidor = 'MENSUAL'
            if (empleado.jornal > 0) {
                montoBaseServidor = empleado.jornal
                cicloServidor = empleado.cicloPago || 'SEMANAL'
            } else if (empleado.rolRel?.jornal) {
                montoBaseServidor = empleado.rolRel.jornal
                cicloServidor = empleado.rolRel.cicloPago || 'SEMANAL'
            }

            const jornalServidor = cicloServidor === 'DIARIO'
                ? montoBaseServidor
                : cicloServidor === 'MENSUAL'
                    ? montoBaseServidor / 30
                    : montoBaseServidor / 6
            const valorHoraNormalServidor = empleado.valorHoraNormal && empleado.valorHoraNormal > 0
                ? empleado.valorHoraNormal
                : jornalServidor / (empleado.horasTrabajoDiarias || 8)
            const valorHoraExtraServidor = empleado.valorHoraExtra > 0
                ? empleado.valorHoraExtra
                : empleado.rolRel?.valorHoraExtra && empleado.rolRel.valorHoraExtra > 0
                    ? empleado.rolRel.valorHoraExtra
                    : valorHoraNormalServidor * 2

            const totales = reconstruirLiquidacionCalculada(
                calculatedData,
                jornalServidor,
                valorHoraExtraServidor,
            )
            sueldoProporcional = totales.sueldoBase
            horasNormales = totales.horasNormales
            horasExtras = totales.horasExtras
            montoHsExtra = totales.montoHorasExtras
            montoHsFeriado = totales.montoHorasFeriado
            diasTrabajados = totales.diasTrabajados
            ajusteHorasExtras = totales.ajusteHorasExtras
            deduccionCuotas = empleado.prestamos.reduce((total, prestamo) => {
                return total + (prestamo.cuotas[0]?.monto || 0)
            }, 0)
        } else {
            // Cálculo Automático basado en fichadas
            const fichadas = empleado.fichadas || []
            const diasSet = new Set<string>()
            fichadas.forEach((f: any) => {
                if (f.tipo !== 'ausencia') {
                    diasSet.add(fechaClaveRRHH(f.fechaHora))
                }
            })

            // Sumar días de inasistencia justificada paga que no tengan fichadas
            const inasistenciasPagas = await prisma.inasistencia.findMany({
                where: {
                    empleadoId: empleado.id,
                    fecha: { gte: rangoPeriodo.gte, lt: rangoPeriodo.lt },
                    tipo: 'JUSTIFICADA_PAGA'
                }
            })

            inasistenciasPagas.forEach(i => {
                diasSet.add(fechaClaveRRHH(i.fecha))
            })

            diasTrabajados = diasSet.size

            let sueldoDia = 0

            if (empleado.cicloPago === 'MENSUAL') {
                sueldoDia = empleado.sueldoBaseMensual / 30
            } else if (empleado.cicloPago === 'QUINCENAL') {
                sueldoDia = (empleado.sueldoBaseMensual / 2) / 15
            } else { // SEMANAL
                sueldoDia = (empleado.sueldoBaseMensual / 4.3) / 6
            }

            sueldoProporcional = sueldoDia * diasTrabajados

            const valorHora = empleado.valorHoraNormal || (empleado.sueldoBaseMensual / 160)
            montoHsNorm = horasNormales * valorHora
            montoHsExtra = horasExtras * valorHora * (1 + (empleado.porcentajeHoraExtra / 100))
            montoHsFeriado = horasFeriado * valorHora * (1 + (empleado.porcentajeFeriado / 100))

            // Descuentos automáticos de préstamos
            empleado.prestamos.forEach((prestamo: any) => {
                const primeraPendiente = prestamo.cuotas[0]
                if (primeraPendiente) {
                    deduccionCuotas += primeraPendiente.monto
                }
            })
        }

        // ─── Incorporar Conceptos Salariales Adicionales ───
        let montoAdicionales = 0
        if (adicionales && adicionales.length > 0) {
            const conceptosIds = [...new Set(adicionales.map(item => item.conceptoSalarialId))]
            if (conceptosIds.some(id => typeof id !== 'string' || !id)) {
                throw new Error('Existe un concepto salarial sin identificador válido.')
            }
            const conceptosActivos = await prisma.conceptoSalarial.count({
                where: { id: { in: conceptosIds }, activo: true }
            })
            if (conceptosActivos !== conceptosIds.length) {
                throw new Error('Uno o más conceptos salariales no existen o están inactivos.')
            }
            montoAdicionales = adicionales.reduce((acc, item) => acc + validarMontoAdicional(item.montoCalculado), 0)
        }

        const neto = sueldoProporcional + montoHsNorm + montoHsExtra + montoHsFeriado + montoAdicionales - deduccionCuotas
        if (!Number.isFinite(neto) || neto < 0) {
            throw new Error('El total neto calculado es inválido o negativo.')
        }

        const cuotasAfectadas: string[] = []
        const debeDescontarPrestamos = manualData ? aplicarCuotasPrestamo : true
        
        if (debeDescontarPrestamos) {
            empleado.prestamos.forEach((prestamo: any) => {
                const primeraPendiente = prestamo.cuotas[0]
                if (primeraPendiente) {
                    cuotasAfectadas.push(primeraPendiente.id)
                }
            })
        }

        const liquidacion = await prisma.$transaction(async (tx) => {
            // Serializar todas las liquidaciones del empleado, no solamente las
            // del mismo periodo: cuotas y horas pendientes son recursos
            // compartidos entre periodos diferentes.
            const lockKey = `liquidacion:${empleado.id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

            // La verificación definitiva ocurre dentro del bloqueo. La consulta
            // previa sólo funciona como salida rápida para el caso habitual.
            const liquidacionPagada = await encontrarLiquidacionDuplicada(tx as unknown as ClienteLiquidaciones, {
                empleadoId: empleado.id,
                periodo,
                tipo: tipoLiquidacion,
                ...rangoCivil,
            })
            if (liquidacionPagada) {
                throw new Error(`El empleado ya tiene una liquidación pagada que se superpone con ${periodo}: ${liquidacionPagada.periodo}.`)
            }

            if (calculatedData) {
                const [vacacionesDiarias, vacacionesPrevias, marcasPeriodo] = await Promise.all([
                    tx.inasistencia.findMany({
                        where: { empleadoId: empleado.id, tipo: 'VACACIONES', fecha: { gte: rangoPeriodo.gte, lt: rangoPeriodo.lt } },
                        select: { fecha: true },
                    }),
                    tx.liquidacionSueldo.findMany({
                        where: { empleadoId: empleado.id, tipo: 'VACACIONES', estado: { not: 'anulado' } },
                        select: { desglose: true },
                    }),
                    tx.fichadaEmpleado.count({
                        where: { empleadoId: empleado.id, fechaHora: { gte: rangoPeriodo.gte, lt: rangoPeriodo.lt }, tipo: { in: ['entrada', 'salida'] } },
                    }),
                ])
                const fechasVacacionesActuales = new Set(vacacionesDiarias.map(dia => fechaClaveRRHH(dia.fecha)))
                vacacionesPrevias.forEach(vacacion => {
                    const rango = rangoVacacionesDesdeDesglose(vacacion.desglose)
                    if (rango) fechasDeRangoVacaciones(rango.desde, rango.hasta).forEach(fecha => fechasVacacionesActuales.add(fecha))
                })
                if (marcasPeriodo === 0 && periodoLaboralCubiertoPorVacaciones(fechaInicio, fechaFin, empleado.diasTrabajoSemana, fechasVacacionesActuales)) {
                    throw new Error('El empleado está de vacaciones durante toda su semana laboral y no corresponde generar una liquidación semanal.')
                }
            }

            if (debeDescontarPrestamos) {
                const cuotasPendientesActuales = await tx.cuotaPrestamo.findMany({
                    where: {
                        prestamo: { empleadoId: empleado.id },
                        estado: 'pendiente',
                        liquidacionId: null,
                        fechaVencimiento: { lt: rangoPeriodo.lt },
                    },
                    orderBy: [
                        { fechaVencimiento: 'asc' },
                        { numeroCuota: 'asc' },
                    ],
                })
                const cuotasEsperadas = seleccionarCuotasVencidasPorPrestamo(cuotasPendientesActuales, rangoPeriodo.lt)
                const idsActuales = cuotasEsperadas.map(cuota => cuota.id).sort()
                const idsCalculados = [...cuotasAfectadas].sort()
                const montoActual = cuotasEsperadas.reduce((total, cuota) => total + cuota.monto, 0)
                const cambiaronCuotas = idsActuales.length !== idsCalculados.length
                    || idsActuales.some((id, indice) => id !== idsCalculados[indice])
                    || Math.abs(montoActual - deduccionCuotas) > 0.009

                if (cambiaronCuotas) {
                    throw new Error('Las cuotas pendientes cambiaron mientras se calculaba la liquidación. Recalculá antes de confirmar.')
                }
            }

            // El borrador, la liquidación, los préstamos y Caja deben
            // confirmarse juntos o revertirse juntos.
            await tx.liquidacionSueldo.deleteMany({
                where: { empleadoId: empleado.id, periodo, estado: 'borrador' }
            })

            const nuevaLiquidacion = await tx.liquidacionSueldo.create({
                data: {
                    empleadoId: empleado.id,
                    periodo: (manualData || calculatedData) ? periodo : `${periodo} (${diasTrabajados} d. trab.)`,
                    periodoDesde: instanteRRHH(rangoCivil.desde),
                    periodoHasta: instanteRRHH(rangoCivil.hasta),
                    registradaEnCaja: Boolean(cajaId && neto > 0),
                    sueldoProporcional,
                    horasNormales,
                    montoHorasNormales: montoHsNorm,
                    horasExtras,
                    montoHorasExtras: montoHsExtra,
                    horasFeriado,
                    montoHorasFeriado: montoHsFeriado,
                    ajusteHorasExtras,
                    descuentosPrestamos: deduccionCuotas,
                    totalNeto: neto,
                    estado: 'pagado',
                    tipo: tipoLiquidacion,
                    desglose: calculatedData?.desglosePorDia || (manualData ? {
                        ...manualData,
                        descuentoPrestamos: deduccionCuotas,
                        cuotasPrestamoIds: cuotasAfectadas,
                    } : null),
                    items: (adicionales && adicionales.length > 0) ? {
                        create: adicionales.map(ad => ({
                            conceptoSalarialId: ad.conceptoSalarialId,
                            montoCalculado: ad.montoCalculado,
                            detalle: ad.detalle
                        }))
                    } : undefined
                }
            })

            if (estadosDiarios?.length) {
                const fechas = estadosDiarios.map(estado => estado.fecha)
                await tx.inasistencia.deleteMany({
                    where: { empleadoId: empleado.id, tipo: 'VACACIONES', fecha: { in: fechas } }
                })
                await tx.inasistencia.createMany({
                    data: estadosDiarios.map(estado => ({
                        empleadoId: empleado.id,
                        fecha: estado.fecha,
                        tipo: estado.tipo,
                        motivo: estado.motivo,
                        observaciones: estado.observaciones,
                    }))
                })
            }

            const prestamosAfectados = new Set<string>()
            for (const cuotaId of cuotasAfectadas) {
                const cuota = await tx.cuotaPrestamo.update({
                    where: { id: cuotaId },
                    data: {
                        estado: 'pagada',
                        fechaPago: new Date(),
                        liquidacionId: nuevaLiquidacion.id
                    }
                })
                prestamosAfectados.add(cuota.prestamoId)
            }

            for (const prestamoId of prestamosAfectados) {
                const pendientes = await tx.cuotaPrestamo.count({
                    where: { prestamoId, estado: 'pendiente' }
                })
                if (pendientes === 0) {
                    await tx.prestamoEmpleado.update({
                        where: { id: prestamoId },
                        data: { estado: 'saldado' }
                    })
                }
            }

            if (cajaId && neto > 0) {
                const caja = await tx.saldoCaja.findUnique({ where: { tipo: cajaId } })
                if (!caja) throw new Error(`La caja '${cajaId}' no existe en el sistema.`)

                await CajaService.createMovimientoEnTx(tx, {
                    tipo: 'egreso',
                    concepto: concepto || 'pago_sueldo',
                    monto: neto,
                    cajaOrigen: cajaId,
                    liquidacionSueldoId: nuevaLiquidacion.id,
                    descripcion: `Liquidación Sueldo: ${empleado.nombre} ${empleado.apellido || ''} - Periodo: ${periodo} (ID: ${nuevaLiquidacion.id})`,
                })
            }

            return tx.liquidacionSueldo.findUniqueOrThrow({
                where: { id: nuevaLiquidacion.id },
                include: {
                    cuotasDescontadas: {
                        select: {
                            id: true,
                            numeroCuota: true,
                            monto: true,
                            fechaVencimiento: true,
                            prestamoId: true,
                        },
                        orderBy: [
                            { fechaVencimiento: 'asc' },
                            { numeroCuota: 'asc' },
                        ],
                    },
                },
            })
        })

        // Evento de dominio
        eventBus.emit('liquidacion:created', {
            liquidacionId: liquidacion.id,
            empleadoId: empleado.id,
            monto: neto
        })

        return liquidacion
    }

    // ─── Anular Liquidación ──────────────────────────────────────────────────
    /**
     * Conserva el recibo y el movimiento original, reabre los recursos
     * asociados y crea una contrapartida de Caja dentro de la misma transacción.
     */
    static async anularLiquidacion(id: string, motivoInformado: unknown, usuarioId: string) {
        const motivo = validarMotivoAnulacionLiquidacion(motivoInformado)
        const liq = await prisma.$transaction(async (tx) => {
            const liquidacionLockKey = `anular-liquidacion:${id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${liquidacionLockKey}))::text AS lock_result`

            const referencia = await tx.liquidacionSueldo.findUnique({
                where: { id },
                select: { empleadoId: true },
            })
            if (!referencia) throw new Error('Liquidación no encontrada.')

            const empleadoLockKey = `liquidacion:${referencia.empleadoId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${empleadoLockKey}))::text AS lock_result`

            const liquidacion = await tx.liquidacionSueldo.findUnique({
                where: { id },
                include: {
                    empleado: { select: { nombre: true, apellido: true } },
                    cuotasDescontadas: true,
                    movimientosCaja: {
                        where: { movimientoReversaDeId: null },
                        include: { movimientoReversion: { select: { id: true } } },
                    },
                }
            })

            if (!liquidacion) throw new Error('Liquidación no encontrada.')
            validarLiquidacionAnulable({
                estado: liquidacion.estado,
                totalNeto: liquidacion.totalNeto,
                registradaEnCaja: liquidacion.registradaEnCaja,
                movimientos: liquidacion.movimientosCaja,
            })

            const prestamosAfectados = [...new Set(
                liquidacion.cuotasDescontadas.map(cuota => cuota.prestamoId)
            )]
            const horasExtrasRestauradas = await tx.horaExtraPendiente.findMany({
                where: { liquidacionId: id },
                select: { id: true, cantidadHoras: true, montoCalculado: true },
            })

            if (liquidacion.cuotasDescontadas.length > 0) {
                await tx.cuotaPrestamo.updateMany({
                    where: { liquidacionId: id },
                    data: {
                        estado: 'pendiente',
                        fechaPago: null,
                        liquidacionId: null
                    }
                })

                await tx.prestamoEmpleado.updateMany({
                    where: { id: { in: prestamosAfectados } },
                    data: { estado: 'activo' }
                })
            }

            await tx.horaExtraPendiente.updateMany({
                where: { liquidacionId: id },
                data: { pagado: false, liquidacionId: null }
            })

            for (const movimiento of liquidacion.movimientosCaja) {
                await CajaService.createMovimientoEnTx(tx, {
                    tipo: 'ingreso',
                    concepto: 'anulacion_liquidacion_sueldo',
                    monto: movimiento.monto,
                    cajaOrigen: movimiento.cajaOrigen,
                    liquidacionSueldoId: liquidacion.id,
                    movimientoReversaDeId: movimiento.id,
                    descripcion: `Anulación liquidación: ${liquidacion.empleado.nombre} ${liquidacion.empleado.apellido || ''} - ${motivo} (Movimiento original: ${movimiento.id})`,
                })
            }

            return tx.liquidacionSueldo.update({
                where: { id },
                data: {
                    estado: 'anulado',
                    motivoAnulacion: motivo,
                    detalleAnulacion: {
                        cuotasRestauradas: liquidacion.cuotasDescontadas.map(cuota => ({
                            id: cuota.id,
                            prestamoId: cuota.prestamoId,
                            numeroCuota: cuota.numeroCuota,
                            monto: cuota.monto,
                        })),
                        horasExtrasRestauradas,
                        movimientosCompensados: liquidacion.movimientosCaja.map(movimiento => ({
                            id: movimiento.id,
                            cajaOrigen: movimiento.cajaOrigen,
                            monto: movimiento.monto,
                        })),
                    },
                    anuladoAt: new Date(),
                    anuladoPorId: usuarioId,
                },
                include: {
                    anuladoPor: { select: { id: true, nombre: true, apellido: true } },
                    movimientosCaja: { orderBy: { createdAt: 'asc' } },
                },
            })
        })

        eventBus.emit('liquidacion:reverted', { liquidacionId: id, empleadoId: liq.empleadoId })

        return liq
    }

    // ─── Listar Liquidaciones ────────────────────────────────────────────────
    static async findLiquidaciones(empleadoId?: string, periodo?: string, incluirAnuladas = false) {
        return prisma.liquidacionSueldo.findMany({
            where: {
                ...(empleadoId ? { empleadoId } : {}),
                ...(periodo ? { periodo } : {}),
                estado: incluirAnuladas ? { in: ['pagado', 'anulado'] } : 'pagado'
            },
            orderBy: { fechaGeneracion: 'desc' },
            include: { 
                cuotasDescontadas: true,
                items: { include: { concepto: true } },
                anuladoPor: { select: { id: true, nombre: true, apellido: true } },
                movimientosCaja: {
                    select: { id: true, tipo: true, cajaOrigen: true, movimientoReversaDeId: true },
                    orderBy: { createdAt: 'asc' },
                },
            }
        })
    }

    // ─── Cálculos Especiales: SAC y Vacaciones ────────────────────────────────
    static async calcularSACPreview(empleadoId: string, anio: number, semestre: 1 | 2) {
        const start = semestre === 1 ? new Date(anio, 0, 1) : new Date(anio, 6, 1);
        const end = semestre === 1 ? new Date(anio, 5, 30, 23, 59, 59) : new Date(anio, 11, 31, 23, 59, 59);

        const liquidaciones = await prisma.liquidacionSueldo.findMany({
            where: {
                empleadoId,
                fechaGeneracion: { gte: start, lte: end },
                estado: 'pagado',
                tipo: 'NORMAL'
            }
        });

        const empleado = await prisma.empleado.findUnique({ 
            where: { id: empleadoId },
            include: { rolRel: true }
        });
        if (!empleado) throw new Error('Empleado no encontrado');

        // Agrupamos por mes para encontrar el mejor mes
        const montosPorMes: Record<number, number> = {};
        liquidaciones.forEach(l => {
            const mes = l.fechaGeneracion.getMonth();
            const bruto = l.sueldoProporcional + l.montoHorasNormales + l.montoHorasExtras + l.montoHorasFeriado;
            montosPorMes[mes] = (montosPorMes[mes] || 0) + bruto;
        });

        // Cascada de prioridad para el sueldo base mensual de referencia
        const sueldoReferencia = empleado.sueldoBaseMensual || (empleado.jornal * 25) || (empleado.rolRel?.jornal ? empleado.rolRel.jornal * 25 : 0);

        const brutoMaximo = Object.values(montosPorMes).length > 0 
            ? Math.max(...Object.values(montosPorMes)) 
            : sueldoReferencia;
        
        // Cálculo de días proporcionales
        let diasBase = 180;
        if (empleado.fechaIngreso && empleado.fechaIngreso > start) {
            const diffTime = Math.abs(end.getTime() - empleado.fechaIngreso.getTime());
            diasBase = Math.min(180, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        const sac = Math.round((brutoMaximo / 2) * (diasBase / 180));

        return { 
            brutoMaximo, 
            sac, 
            diasTrabajados: diasBase, 
            mesesConsiderados: Object.keys(montosPorMes).length,
            periodo: `${anio}-${semestre}`
        };
    }

    static async calcularVacacionesPreview(empleadoId: string, anio: number) {
        const empleado = await prisma.empleado.findUnique({ 
            where: { id: empleadoId },
            include: { rolRel: true }
        });
        if (!empleado) throw new Error('Empleado no encontrado');

        if (!empleado.fechaIngreso) return { dias: 0, monto: 0, antiguedad: 0 };

        const hoy = new Date();
        const antiguedad = hoy.getFullYear() - empleado.fechaIngreso.getFullYear();
        
        let dias = 14;
        if (antiguedad >= 20) dias = 35;
        else if (antiguedad >= 10) dias = 28;
        else if (antiguedad >= 5) dias = 21;

        // Valor vacaciones: Empleado -> Rol -> Sueldo Base
        let valorDia = 0;
        if (empleado.jornal > 0) {
            valorDia = empleado.jornal;
        } else if (empleado.rolRel?.jornal) {
            valorDia = empleado.rolRel.jornal;
        } else if (empleado.sueldoBaseMensual > 0) {
            valorDia = empleado.sueldoBaseMensual / 25;
        }
            
        const monto = Math.round(valorDia * dias);

        return {
            dias,
            monto,
            antiguedad,
            fechaIngreso: empleado.fechaIngreso
        };
    }
}
