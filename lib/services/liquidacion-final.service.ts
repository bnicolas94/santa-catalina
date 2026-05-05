import { prisma } from '@/lib/prisma'
import { CajaService } from './caja.service'

export interface LiquidacionFinalInput {
    empleadoId: string
    fechaEgreso: string
    causaEgreso: 'RENUNCIA' | 'DESPIDO_SIN_CAUSA' | 'DESPIDO_CON_CAUSA' | 'FIN_CONTRATO'
    omitirPreaviso?: boolean
}

export interface DetalleConcepto {
    nombre: string
    monto: number
    tipo: 'REMUNERATIVO' | 'NO_REMUNERATIVO' | 'DESCUENTO'
    metodologia: string
}

export class LiquidacionFinalService {
    /**
     * Calcula la liquidación final sin persistir datos (simulación).
     */
    static async calcular(input: LiquidacionFinalInput) {
        const { empleadoId, fechaEgreso, causaEgreso, omitirPreaviso } = input
        const egreso = new Date(fechaEgreso)
        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            include: { rolRel: true }
        })

        if (!empleado || !empleado.fechaIngreso) {
            throw new Error('Empleado no encontrado o sin fecha de ingreso')
        }

        if (!empleado.activo) {
            throw new Error('El empleado ya se encuentra inactivo.')
        }

        const ingreso = new Date(empleado.fechaIngreso)
        if (egreso < ingreso) {
            throw new Error('La fecha de egreso no puede ser anterior a la fecha de ingreso.')
        }
        
        // Determinar el sueldo base para el cálculo (Mensual o Jornal * 30)
        let sueldoBase = empleado.sueldoBaseMensual || 0
        
        if (sueldoBase === 0) {
            const jornal = empleado.jornal || empleado.rolRel?.jornal || 0
            if (jornal > 0) {
                sueldoBase = jornal * 30
            }
        }

        if (sueldoBase === 0) {
            throw new Error('El empleado no tiene sueldo base ni jornal configurado.')
        }

        // 1. Días trabajados en el mes
        const diasMesEgreso = egreso.getDate()
        const diasTotalesMes = new Date(egreso.getFullYear(), egreso.getMonth() + 1, 0).getDate()
        const montoDiasMes = this.redondear((sueldoBase / 30) * diasMesEgreso)

        // 2. SAC Proporcional
        const sacProporcional = this.redondear(this.calcularSACProporcional(egreso, sueldoBase))

        // 3. Vacaciones No Gozadas
        const antiguedadAnios = this.calcularAntiguedad(ingreso, egreso)
        const vacacionesData = this.calcularVacacionesNoGozadas(ingreso, egreso, antiguedadAnios, sueldoBase)

        // 4. Indemnizaciones (si aplica)
        let indemnizacionAntiguedad = 0
        let indemnizacionPreaviso = 0
        let integracionMes = 0

        if (causaEgreso === 'DESPIDO_SIN_CAUSA') {
            const aniosParaIndemnizacion = this.calcularAniosIndemnizacion(ingreso, egreso)
            indemnizacionAntiguedad = this.redondear(sueldoBase * aniosParaIndemnizacion)

            if (omitirPreaviso) {
                const mesesPreaviso = antiguedadAnios < 5 ? 1 : 2
                indemnizacionPreaviso = this.redondear(sueldoBase * mesesPreaviso)

                if (diasMesEgreso < diasTotalesMes) {
                    const diasRestantes = diasTotalesMes - diasMesEgreso
                    integracionMes = this.redondear((sueldoBase / 30) * diasRestantes)
                }
            }
        }

        // SAC sobre Indemnizaciones (Sustitutiva Preaviso e Integración son indemnizatorias, pero llevan SAC en algunos criterios, LCT dice que sí)
        const sacSobrePreavisoEIntegracion = this.redondear((indemnizacionPreaviso + integracionMes) / 12)

        const items: DetalleConcepto[] = [
            { 
                nombre: `Días Trabajados (${diasMesEgreso} días)`, 
                monto: montoDiasMes, 
                tipo: 'REMUNERATIVO',
                metodologia: `(Sueldo / 30) * ${diasMesEgreso} días trabajados en el mes.`
            },
            { 
                nombre: 'SAC Proporcional', 
                monto: sacProporcional, 
                tipo: 'REMUNERATIVO',
                metodologia: `Sueldo Anual Complementario proporcional al tiempo trabajado en el semestre.`
            },
            { 
                nombre: `Vacaciones No Gozadas (${vacacionesData.dias.toFixed(2)} días)`, 
                monto: this.redondear(vacacionesData.monto), 
                tipo: 'NO_REMUNERATIVO',
                metodologia: `(Días Totales / 365) * Días trabajados en el año. Pagado con plus vacacional (Sueldo / 25).`
            },
            { 
                nombre: 'SAC sobre Vacaciones No Gozadas', 
                monto: this.redondear(vacacionesData.monto / 12), 
                tipo: 'NO_REMUNERATIVO',
                metodologia: `1/12 del monto de Vacaciones No Gozadas.`
            }
        ]

        if (indemnizacionAntiguedad > 0) {
            items.push({ 
                nombre: 'Indemnización por Antigüedad (Art. 245)', 
                monto: indemnizacionAntiguedad, 
                tipo: 'NO_REMUNERATIVO',
                metodologia: `1 sueldo por cada año de antigüedad o fracción mayor a 3 meses.`
            })
        }
        if (indemnizacionPreaviso > 0) {
            items.push({ 
                nombre: 'Indemnización Sustitutiva Preaviso', 
                monto: indemnizacionPreaviso, 
                tipo: 'NO_REMUNERATIVO',
                metodologia: `1 mes de sueldo (antigüedad < 5 años) o 2 meses (antigüedad > 5 años).`
            })
        }
        if (integracionMes > 0) {
            items.push({ 
                nombre: 'Integración Mes de Despido', 
                monto: integracionMes, 
                tipo: 'NO_REMUNERATIVO',
                metodologia: `Monto correspondiente a los días restantes para terminar el mes de despido.`
            })
        }
        if (sacSobrePreavisoEIntegracion > 0) {
            items.push({ 
                nombre: 'SAC sobre Preaviso e Integración', 
                monto: sacSobrePreavisoEIntegracion, 
                tipo: 'NO_REMUNERATIVO',
                metodologia: `1/12 de las indemnizaciones por preaviso e integración.`
            })
        }

        // 5. Deducciones (Préstamos pendientes)
        const cuotasPendientes = await prisma.cuotaPrestamo.findMany({
            where: {
                prestamo: { empleadoId, estado: 'activo' },
                estado: 'pendiente'
            }
        })
        const totalDeduccionPrestamos = cuotasPendientes.reduce((acc, c) => acc + c.monto, 0)
        if (totalDeduccionPrestamos > 0) {
            items.push({
                nombre: 'Deducción Préstamos Pendientes (Cancelación)',
                monto: -this.redondear(totalDeduccionPrestamos),
                tipo: 'DESCUENTO',
                metodologia: 'Cancelación de todas las cuotas pendientes de préstamos activos al momento del egreso.'
            })
        }

        const totalHaberes = this.redondear(items.filter(i => i.monto > 0).reduce((acc, i) => acc + i.monto, 0))
        const totalDescuentos = this.redondear(Math.abs(items.filter(i => i.monto < 0).reduce((acc, i) => acc + i.monto, 0)))
        const totalNeto = this.redondear(totalHaberes - totalDescuentos)

        return {
            empleadoId,
            nombreEmpleado: `${empleado.nombre} ${empleado.apellido || ''}`,
            sueldoReferencia: sueldoBase,
            ingreso: empleado.fechaIngreso,
            egreso: fechaEgreso,
            antiguedadAnios,
            causaEgreso,
            items,
            totalHaberes,
            totalDescuentos,
            totalNeto
        }
    }

    /**
     * Confirma la liquidación, persiste en DB, impacta en Caja y desactiva al empleado.
     */
    static async confirmar(input: LiquidacionFinalInput, itemsFinales: DetalleConcepto[]) {
        const calculoBase = await this.calcular(input)
        
        // Totales basados en lo que realmente se va a guardar (permitiendo edición manual previa)
        const totalHaberes = this.redondear(itemsFinales.filter(i => i.monto > 0).reduce((acc, i) => acc + i.monto, 0))
        const totalDescuentos = this.redondear(Math.abs(itemsFinales.filter(i => i.monto < 0).reduce((acc, i) => acc + i.monto, 0)))
        const totalNeto = this.redondear(totalHaberes - totalDescuentos)

        return await prisma.$transaction(async (tx) => {
            // 1. Crear el registro de Liquidación Final
            const liquidacion = await tx.liquidacionFinal.create({
                data: {
                    empleadoId: input.empleadoId,
                    fechaEgreso: new Date(input.fechaEgreso),
                    tipoEgreso: input.causaEgreso,
                    antiguedadAnios: calculoBase.antiguedadAnios,
                    detalleConceptos: itemsFinales as any,
                    totalHaberes,
                    totalDescuentos,
                    totalNeto,
                }
            })

            // 2. Generar egreso en Caja
            await CajaService.createMovimientoEnTx(tx, {
                tipo: 'egreso',
                concepto: 'LIQUIDACION_FINAL',
                monto: totalNeto,
                cajaOrigen: 'caja_madre', // O la que corresponda por defecto
                descripcion: `Liquidación Final Empleado: ${calculoBase.nombreEmpleado} (${input.causaEgreso})`,
                fecha: new Date(input.fechaEgreso)
            })

            // 3. Desactivar al empleado
            await tx.empleado.update({
                where: { id: input.empleadoId },
                data: { activo: false }
            })

            // 4. Cancelar préstamos si hubo descuento
            if (totalDescuentos > 0) {
                // Buscamos las cuotas que mencionamos en el cálculo
                await tx.cuotaPrestamo.updateMany({
                    where: {
                        prestamo: { empleadoId: input.empleadoId, estado: 'activo' },
                        estado: 'pendiente'
                    },
                    data: {
                        estado: 'pagado',
                        fechaPago: new Date()
                    }
                })
                
                // Marcar préstamos como completados
                await tx.prestamoEmpleado.updateMany({
                    where: { empleadoId: input.empleadoId, estado: 'activo' },
                    data: { estado: 'completado' }
                })
            }

            return liquidacion
        })
    }

    private static calcularSACProporcional(egreso: Date, sueldo: number) {
        const mes = egreso.getMonth() // 0-11
        const esPrimerSemestre = mes < 6
        const inicioSemestre = esPrimerSemestre 
            ? new Date(egreso.getFullYear(), 0, 1) 
            : new Date(egreso.getFullYear(), 6, 1)
        
        const diasTrabajadosSemestre = Math.floor((egreso.getTime() - inicioSemestre.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const diasSemestre = esPrimerSemestre ? 181 : 184
        
        return (sueldo / 2) * (diasTrabajadosSemestre / diasSemestre)
    }

    private static calcularAntiguedad(ingreso: Date, egreso: Date) {
        let diff = egreso.getFullYear() - ingreso.getFullYear()
        const m = egreso.getMonth() - ingreso.getMonth()
        if (m < 0 || (m === 0 && egreso.getDate() < ingreso.getDate())) {
            diff--
        }
        return diff
    }

    private static calcularAniosIndemnizacion(ingreso: Date, egreso: Date) {
        const diffYears = egreso.getFullYear() - ingreso.getFullYear()
        const diffMonths = (egreso.getMonth() - ingreso.getMonth()) + (diffYears * 12)
        const partialMonths = diffMonths % 12
        return Math.floor(diffMonths / 12) + (partialMonths >= 3 ? 1 : 0)
    }

    private static calcularVacacionesNoGozadas(ingreso: Date, egreso: Date, antiguedad: number, sueldo: number) {
        let diasTotales = 14
        if (antiguedad >= 5) diasTotales = 21
        if (antiguedad >= 10) diasTotales = 28
        if (antiguedad >= 20) diasTotales = 35

        const inicioAnio = new Date(egreso.getFullYear(), 0, 1)
        const diasTrabajadosAnio = Math.floor((egreso.getTime() - inicioAnio.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const diasProporcionales = (diasTotales / 365) * diasTrabajadosAnio
        const monto = (sueldo / 25) * diasProporcionales
        return { dias: diasProporcionales, monto }
    }

    private static redondear(num: number) {
        return Math.round((num + Number.EPSILON) * 100) / 100
    }
}
