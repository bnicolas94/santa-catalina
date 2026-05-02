import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'
import { CajaService } from '@/lib/services/caja.service'
import { agruparFichadasPorDia, calcularResumenDia } from '@/utils/horas'

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
    montoHorasExtras: number
    montoHorasFeriado: number
    descuentoPrestamos: number
    totalNeto: number
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
    tipo?: string
    adicionales?: { conceptoSalarialId: string; montoCalculado: number; detalle?: string }[]
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
        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            include: {
                rolRel: true,
                fichadas: {
                    where: {
                        fechaHora: {
                            gte: new Date(fechaInicio + 'T00:00:00'),
                            lte: new Date(fechaFin + 'T23:59:59')
                        }
                    },
                    include: { tipoLicencia: true }
                }
            }
        })

        if (!empleado) throw new Error('Empleado no encontrado')

        // 1. Obtener feriados en el periodo
        const feriados = await prisma.feriado.findMany({
            where: {
                fecha: {
                    gte: new Date(fechaInicio + 'T00:00:00'),
                    lte: new Date(fechaFin + 'T23:59:59')
                }
            }
        })

        const feriadosMap: Record<string, string> = {}
        feriados.forEach(f => {
            const d = new Date(f.fecha)
            const fStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

            // Ajuste de horario de entrada configurado
            const marcas = marcasRaw.map((m: any, idx: number) => {
                if (idx === 0 && m.tipo === 'entrada' && empleado.horarioEntrada) {
                    const [hH, hM] = empleado.horarioEntrada.split(':').map(Number)
                    const dMarca = new Date(m.fechaHora)
                    const dConfig = new Date(dMarca)
                    dConfig.setHours(hH, hM, 0, 0)

                    if (dMarca < dConfig) {
                        return { ...m, fechaHora: dConfig.toISOString() }
                    }
                }
                return m
            })

            const resumen = calcularResumenDia(marcas, hsJornada)

            // Cálculo de Tardanza para compensar horas extras
            let minutosTardanza = 0
            if (empleado.horarioEntrada && marcas.length > 0) {
                const primerEntrada = marcas.find((m: any) => m.tipo === 'entrada')?.fechaHora
                if (primerEntrada) {
                    const [hH, hM] = empleado.horarioEntrada.split(':').map(Number)
                    const dEntrada = new Date(primerEntrada)
                    const dConfig = new Date(dEntrada)
                    dConfig.setHours(hH, hM, 0, 0)
                    
                    if (dEntrada > dConfig) {
                        minutosTardanza = (dEntrada.getTime() - dConfig.getTime()) / (1000 * 60)
                    }
                }
            }

            // Regla: HS Extras compensadas por tardanza y redondeadas al 0.5 más cercano
            const hsExtrasNetas = Math.max(0, resumen.horasExtras - (minutosTardanza / 60))
            const hsExtrasRedondeadas = Math.round(hsExtrasNetas * 2) / 2

            const esFeriado = !!feriadosMap[fechaStr]

            // Cálculos del día
            const multiplicadorJornal = 1.0 // Por defecto día completo si hay marcas
            const valorDiaBase = marcas.length > 0 ? (jornalBase * multiplicadorJornal) : 0
            const valorExtra = hsExtrasRedondeadas * valorHoraExtra
            // Recargo feriado: 50% extra del valor de la hora.
            // REGLA: Si trabajó, el recargo se aplica sobre MÍNIMO la hsJornada, o la real si fue mayor.
            const hsEfectivasFeriado = (esFeriado && resumen.horasTrabajadas > 0)
                ? Math.max(resumen.horasTrabajadas, hsJornada)
                : 0
            const valorFeriado = esFeriado ? (hsEfectivasFeriado * valorHora * 0.5) : 0

            const primerEntrada = marcas.find((m: any) => m.tipo === 'entrada')?.fechaHora
            const ultimaSalida = [...marcas].reverse().find((m: any) => m.tipo === 'salida')?.fechaHora

            desglosePorDia.push({
                fecha: fechaStr,
                diaSemana: nombresDias[current.getDay()],
                esFeriado,
                nombreFeriado: feriadosMap[fechaStr],
                horasTrabajadas: resumen.horasTrabajadas,
                horasExtras: hsExtrasRedondeadas,
                entrada: primerEntrada ? new Date(primerEntrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                salida: ultimaSalida ? new Date(ultimaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                jornalBase: Math.round(jornalBase),
                valorDiaBase: Math.round(valorDiaBase),
                multiplicadorJornal,
                valorExtra: Math.round(valorExtra),
                valorFeriado: Math.round(valorFeriado),
                totalDia: Math.round(valorDiaBase + valorExtra + valorFeriado),
                esJustificado: marcas.some((m: any) => m.origen === 'justificada')
            })

            current.setDate(current.getDate() + 1)
        }

        // 4. Buscar Préstamos/Cuotas del período
        const todasPendientes = await prisma.cuotaPrestamo.findMany({
            where: {
                prestamo: { empleadoId, estado: 'activo' },
                estado: 'pendiente',
                fechaVencimiento: { lte: end }
            },
            orderBy: { numeroCuota: 'asc' }
        })

        // Una cuota por préstamo (acoplamiento paralelo)
        const porPrestamo: Record<string, any> = {}
        todasPendientes.forEach(c => {
            if (!porPrestamo[c.prestamoId]) {
                porPrestamo[c.prestamoId] = c
            }
        })

        const cuotasADescontar = Object.values(porPrestamo)
        const descuentoPrestamos = cuotasADescontar.reduce((acc: number, c: any) => acc + c.monto, 0)

        // 5. Consolidar Resumen
        const diasTrabajados = desglosePorDia.filter(d => d.horasTrabajadas > 0).length
        const sueldoBase = desglosePorDia.reduce((acc, d) => acc + d.valorDiaBase, 0)
        const montoHorasExtras = desglosePorDia.reduce((acc, d) => acc + d.valorExtra, 0)
        const montoHorasFeriado = desglosePorDia.reduce((acc, d) => acc + d.valorFeriado, 0)
        const horasNormales = desglosePorDia.reduce((acc, d) => acc + (d.horasTrabajadas - d.horasExtras), 0)
        const horasExtrasTotales = desglosePorDia.reduce((acc, d) => acc + d.horasExtras, 0)
        const horasFeriadoTotales = desglosePorDia.reduce((acc, d) => acc + (d.esFeriado ? d.horasTrabajadas : 0), 0)

        const totalNeto = sueldoBase + montoHorasExtras + montoHorasFeriado - descuentoPrestamos

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
            montoHorasExtras,
            montoHorasFeriado,
            descuentoPrestamos,
            totalNeto,
            desglosePorDia
        }
    }

    // ─── Ejecutar Liquidación ────────────────────────────────────────────────
    /**
     * Crea la liquidación, marca cuotas de préstamos y registra en caja.
     * Soporta 3 modos: automático (fichadas), calculado (WeeklyPayroll), manual (Express).
     */
    static async ejecutarLiquidacion(input: LiquidacionInput) {
        const { empleadoId, periodo, fechaInicio, fechaFin, cajaId, concepto, manualData, calculatedData, adicionales, tipo } = input

        if (!empleadoId || !periodo) {
            throw new Error('Faltan datos obligatorios')
        }

        // Verificar duplicación de liquidación pagada
        const existente = await prisma.liquidacionSueldo.findFirst({
            where: { empleadoId, periodo, estado: 'pagado' }
        })
        if (existente) {
            throw new Error(`El empleado ya tiene una liquidación pagada para el periodo ${periodo}.`)
        }

        if (!fechaInicio || !fechaFin) {
            throw new Error('Faltan datos para la liquidación')
        }

        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            include: {
                fichadas: {
                    where: {
                        fechaHora: { gte: new Date(fechaInicio), lte: new Date(fechaFin) }
                    },
                    orderBy: { fechaHora: 'asc' }
                },
                prestamos: {
                    where: { estado: 'activo' },
                    include: {
                        cuotas: {
                            where: { estado: 'pendiente' },
                            orderBy: { numeroCuota: 'asc' }
                        }
                    }
                }
            }
        })

        if (!empleado) throw new Error('Empleado no encontrado')

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
            deduccionCuotas = manualData.descuentoPrestamos || 0
            diasTrabajados = manualData.diasTrabajados || 0
        } else if (calculatedData) {
            // Liquidación Automática (vía WeeklyPayrollModal)
            sueldoProporcional = calculatedData.sueldoBase || 0
            horasNormales = calculatedData.horasNormales || 0
            montoHsNorm = calculatedData.montoHorasNormales || 0
            horasExtras = calculatedData.horasExtras || 0
            montoHsExtra = calculatedData.montoHorasExtras || 0
            horasFeriado = calculatedData.horasFeriado || 0
            montoHsFeriado = calculatedData.montoHorasFeriado || 0
            deduccionCuotas = calculatedData.descuentoPrestamos || 0
            diasTrabajados = calculatedData.diasTrabajados || 0
            ajusteHorasExtras = calculatedData.ajusteHorasExtras || 0
        } else {
            // Cálculo Automático basado en fichadas
            const fichadas = empleado.fichadas || []
            const diasSet = new Set<string>()
            fichadas.forEach((f: any) => {
                if (f.tipo !== 'ausencia') {
                    const d = new Date(f.fechaHora)
                    diasSet.add(d.toISOString().split('T')[0])
                }
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
            montoAdicionales = adicionales.reduce((acc, item) => acc + item.montoCalculado, 0)
        }

        const neto = sueldoProporcional + montoHsNorm + montoHsExtra + montoHsFeriado + montoAdicionales - deduccionCuotas

        const cuotasAfectadas: string[] = []
        if (!manualData && !calculatedData) {
            empleado.prestamos.forEach((prestamo: any) => {
                const primeraPendiente = prestamo.cuotas[0]
                if (primeraPendiente) {
                    cuotasAfectadas.push(primeraPendiente.id)
                }
            })
        }

        // Eliminar borradores existentes
        await prisma.liquidacionSueldo.deleteMany({
            where: { empleadoId: empleado.id, periodo, estado: 'borrador' }
        })

        // Crear liquidación
        const liquidacion = await prisma.liquidacionSueldo.create({
            data: {
                empleadoId: empleado.id,
                periodo: (manualData || calculatedData) ? periodo : `${periodo} (${diasTrabajados} d. trab.)`,
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
                tipo: tipo || 'NORMAL',
                desglose: calculatedData?.desglosePorDia || manualData || null,
                items: (adicionales && adicionales.length > 0) ? {
                    create: adicionales.map(ad => ({
                        conceptoSalarialId: ad.conceptoSalarialId,
                        montoCalculado: ad.montoCalculado,
                        detalle: ad.detalle
                    }))
                } : undefined
            }
        })

        // Marcar cuotas como pagadas
        const finalCuotasAfectadas = [...cuotasAfectadas]
        if (calculatedData && calculatedData.descuentoPrestamos > 0) {
            const cp = await prisma.cuotaPrestamo.findMany({
                where: { prestamo: { empleadoId }, estado: 'pendiente' },
                orderBy: { numeroCuota: 'asc' },
                take: 1
            })
            if (cp[0]) finalCuotasAfectadas.push(cp[0].id)
        }

        for (const cuotaId of finalCuotasAfectadas) {
            await prisma.cuotaPrestamo.update({
                where: { id: cuotaId },
                data: {
                    estado: 'pagada',
                    fechaPago: new Date(),
                    liquidacionId: liquidacion.id
                }
            })
        }

        // Registro en Caja
        if (cajaId && neto > 0) {
            const conceptoFinal = concepto || 'pago_sueldo'
            const caja = await prisma.saldoCaja.findUnique({ where: { tipo: cajaId } })
            if (!caja) throw new Error(`La caja '${cajaId}' no existe en el sistema.`)

            await CajaService.createMovimiento({
                tipo: 'egreso',
                concepto: conceptoFinal,
                monto: neto,
                cajaOrigen: cajaId,
                descripcion: `Liquidación Sueldo: ${empleado.nombre} ${empleado.apellido || ''} - Periodo: ${periodo} (ID: ${liquidacion.id})`,
            })
        }

        // Evento de dominio
        eventBus.emit('liquidacion:created', {
            liquidacionId: liquidacion.id,
            empleadoId: empleado.id,
            monto: neto
        })

        return liquidacion
    }

    // ─── Revertir Liquidación ────────────────────────────────────────────────
    /**
     * Revierte una liquidación: reabre cuotas, restaura movimiento de caja, elimina registro.
     * NUNCA pierde datos históricos — las cuotas vuelven a pendiente, no se borran.
     */
    static async revertirLiquidacion(id: string) {
        const liq = await prisma.liquidacionSueldo.findUnique({
            where: { id },
            include: { cuotasDescontadas: true }
        })

        if (!liq) throw new Error('Liquidación no encontrada')

        // 1. Revertir cuotas de préstamos
        if (liq.cuotasDescontadas.length > 0) {
            await prisma.cuotaPrestamo.updateMany({
                where: { liquidacionId: id },
                data: {
                    estado: 'pendiente',
                    fechaPago: null,
                    liquidacionId: null
                }
            })
        }

        // 2. Buscar y revertir movimiento de caja asociado
        const movCaja = await prisma.movimientoCaja.findFirst({
            where: {
                descripcion: { contains: `(ID: ${id})` },
                tipo: 'egreso'
            }
        })

        if (movCaja) {
            await CajaService.deleteMovimiento(movCaja.id)
        }

        // 3. Eliminar la liquidación
        await prisma.liquidacionSueldo.delete({ where: { id } })

        eventBus.emit('liquidacion:reverted', { liquidacionId: id, empleadoId: liq.empleadoId })

        return { ok: true }
    }

    // ─── Listar Liquidaciones ────────────────────────────────────────────────
    static async findLiquidaciones(empleadoId?: string, periodo?: string) {
        return prisma.liquidacionSueldo.findMany({
            where: {
                ...(empleadoId ? { empleadoId } : {}),
                ...(periodo ? { periodo } : {}),
                estado: 'pagado'
            },
            orderBy: { fechaGeneracion: 'desc' },
            include: { 
                cuotasDescontadas: true,
                items: { include: { concepto: true } }
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
