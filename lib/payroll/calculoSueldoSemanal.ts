import { prisma } from '@/lib/prisma'
import { agruparFichadasPorDia, calcularResumenDia } from '@/utils/horas'

export interface DiaTrabajado {
    fecha: string
    diaSemana: string
    esFeriado: boolean
    nombreFeriado?: string
    horasTrabajadas: number
    horasExtras: number
    entrada: string | null
    salida: string | null
    valorDiaBase: number
    valorExtra: number
    valorFeriado: number
    totalDia: number
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
    montoHorasExtras: number
    montoHorasFeriado: number
    descuentoPrestamos: number
    totalNeto: number
    desglosePorDia: DiaTrabajado[]
}

export async function calcularSueldoSemanal(
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
        // Por defecto SEMANAL o QUINCENAL se aproxima a 6 días laborales para el cálculo del jornal diario
        jornalBase = montoBase / 6
    }

    const hsJornada = empleado.horasTrabajoDiarias || 8
    const valorHora = hsJornada > 0 ? jornalBase / hsJornada : 0
    const valorHoraExtra = valorHora * 2 // HS Extras se pagan al 100% adicional (Doble)

    // 3. Procesar Fichadas
    const fichadas = empleado.fichadas
    const gruposPorDia = agruparFichadasPorDia(fichadas)
    
    // Generar rango de fechas (Lunes a Domingo)
    const desglosePorDia: DiaTrabajado[] = []
    const [startYear, startMonth, startDay] = fechaInicio.split('-').map(Number)
    const [endYear, endMonth, endDay] = fechaFin.split('-').map(Number)
    
    let current = new Date(startYear, startMonth - 1, startDay)
    const end = new Date(endYear, endMonth - 1, endDay)
    
    // Nombres de días para el resumen (Ajustado para que el índice coincida con getDay())
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

    while (current <= end) {
        const year = current.getFullYear()
        const month = String(current.getMonth() + 1).padStart(2, '0')
        const day = String(current.getDate()).padStart(2, '0')
        const fechaStr = `${year}-${month}-${day}`
        const marcas = gruposPorDia[fechaStr] || []
        const resumen = calcularResumenDia(marcas, hsJornada)
        
        // Regla del usuario: HS Extras redondeadas al 0.5 más cercano
        const hsExtrasOriginal = resumen.horasExtras
        const hsExtrasRedondeadas = Math.round(hsExtrasOriginal * 2) / 2

        const esFeriado = !!feriadosMap[fechaStr]
        
        // Cálculos del día
        const valorDiaBase = marcas.length > 0 ? jornalBase : 0
        const valorExtra = hsExtrasRedondeadas * valorHoraExtra
        // Recargo feriado: 50% extra del valor de la hora por hora trabajada
        const valorFeriado = esFeriado ? (resumen.horasTrabajadas * valorHora * 0.5) : 0

        const primerEntrada = marcas.find(m => m.tipo === 'entrada')?.fechaHora
        const ultimaSalida = [...marcas].reverse().find(m => m.tipo === 'salida')?.fechaHora

        desglosePorDia.push({
            fecha: fechaStr,
            diaSemana: nombresDias[current.getDay()],
            esFeriado,
            nombreFeriado: feriadosMap[fechaStr],
            horasTrabajadas: resumen.horasTrabajadas,
            horasExtras: hsExtrasRedondeadas,
            entrada: primerEntrada ? new Date(primerEntrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
            salida: ultimaSalida ? new Date(ultimaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
            valorDiaBase: Math.round(valorDiaBase),
            valorExtra: Math.round(valorExtra),
            valorFeriado: Math.round(valorFeriado),
            totalDia: Math.round(valorDiaBase + valorExtra + valorFeriado)
        })

        current.setDate(current.getDate() + 1)
    }

    // 4. Buscar Préstamos/Cuotas del período
    const cuotasPendientes = await prisma.cuotaPrestamo.findMany({
        where: {
            prestamo: { empleadoId },
            estado: 'pendiente'
        },
        orderBy: { numeroCuota: 'asc' },
        take: 1 // Tomamos una cuota por liquidación semanal (o ajustar según lógica)
    })
    const descuentoPrestamos = cuotasPendientes.reduce((acc, c) => acc + c.monto, 0)

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
        montoHorasExtras,
        montoHorasFeriado,
        descuentoPrestamos,
        totalNeto,
        desglosePorDia
    }
}
