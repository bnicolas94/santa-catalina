import { prisma } from '@/lib/prisma'

export interface LiquidacionFinalInput {
    empleadoId: string
    fechaEgreso: string
    causaEgreso: 'RENUNCIA' | 'DESPIDO_SIN_CAUSA' | 'DESPIDO_CON_CAUSA' | 'FIN_CONTRATO' | 'MUTUO_ACUERDO'
    omitirPreaviso?: boolean
}

export class LiquidacionFinalService {
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

        const ingreso = new Date(empleado.fechaIngreso)
        
        // Determinar el sueldo base para el cálculo (Mensual o Jornal * 30)
        let sueldoBase = empleado.sueldoBaseMensual || 0
        
        if (sueldoBase === 0) {
            const jornal = empleado.jornal || empleado.rolRel?.jornal || 0
            if (jornal > 0) {
                // Si es jornalizado, calculamos un equivalente mensual de 25 días (estándar LCT para proporcional)
                // o 30 días según el criterio. Vamos con 30 para cubrir la remuneración mensual habitual.
                sueldoBase = jornal * 30
            }
        }

        if (sueldoBase === 0) {
            throw new Error('El empleado no tiene sueldo base ni jornal configurado. Por favor, asigne una remuneración en su perfil.')
        }

        // 1. Días trabajados en el mes
        const diasMesEgreso = egreso.getDate()
        const diasTotalesMes = new Date(egreso.getFullYear(), egreso.getMonth() + 1, 0).getDate()
        const montoDiasMes = (sueldoBase / 30) * diasMesEgreso

        // 2. SAC Proporcional
        const sacProporcional = this.calcularSACProporcional(egreso, sueldoBase)

        // 3. Vacaciones No Gozadas
        const antiguedadAnios = this.calcularAntiguedad(ingreso, egreso)
        const vacacionesData = this.calcularVacacionesNoGozadas(ingreso, egreso, antiguedadAnios, sueldoBase)

        // 4. Indemnizaciones (si aplica)
        let indemnizacionAntiguedad = 0
        let indemnizacionPreaviso = 0
        let integracionMes = 0

        if (causaEgreso === 'DESPIDO_SIN_CAUSA') {
            // Art 245 LCT: 1 sueldo por año o fracción mayor a 3 meses
            const aniosParaIndemnizacion = this.calcularAniosIndemnizacion(ingreso, egreso)
            indemnizacionAntiguedad = sueldoBase * aniosParaIndemnizacion

            if (omitirPreaviso) {
                // Preaviso: 1 mes si < 5 años, 2 meses si > 5 años
                const mesesPreaviso = antiguedadAnios < 5 ? 1 : 2
                indemnizacionPreaviso = sueldoBase * mesesPreaviso

                // Integración mes de despido (si no es el último día del mes)
                if (diasMesEgreso < diasTotalesMes) {
                    const diasRestantes = diasTotalesMes - diasMesEgreso
                    integracionMes = (sueldoBase / 30) * diasRestantes
                }
            }
        }

        // SAC sobre Indemnizaciones
        const sacSobrePreavisoEIntegracion = (indemnizacionPreaviso + integracionMes) / 12

        const items = [
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
                monto: vacacionesData.monto, 
                tipo: 'NO_REMUNERATIVO',
                metodologia: `(Días Totales / 365) * Días trabajados en el año. Pagado con plus vacacional (Sueldo / 25).`
            },
            { 
                nombre: 'SAC sobre Vacaciones No Gozadas', 
                monto: vacacionesData.monto / 12, 
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

        const totalNeto = items.reduce((acc, item) => acc + item.monto, 0)

        return {
            empleado: `${empleado.nombre} ${empleado.apellido || ''}`,
            sueldoReferencia: sueldoBase,
            ingreso: empleado.fechaIngreso,
            egreso: fechaEgreso,
            antiguedad: `${antiguedadAnios} años`,
            items,
            totalNeto
        }
    }

    private static calcularSACProporcional(egreso: Date, sueldo: number) {
        const mes = egreso.getMonth() // 0-11
        const esPrimerSemestre = mes < 6
        const inicioSemestre = esPrimerSemestre 
            ? new Date(egreso.getFullYear(), 0, 1) 
            : new Date(egreso.getFullYear(), 6, 1)
        
        const diasTrabajadosSemestre = Math.floor((egreso.getTime() - inicioSemestre.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const diasSemestre = esPrimerSemestre ? 181 : 184 // Aproximado
        
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
        
        // Fracción mayor a 3 meses cuenta como año completo
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
        // Plus vacacional: sueldo / 25
        const monto = (sueldo / 25) * diasProporcionales
        
        return { dias: diasProporcionales, monto }
    }
}
