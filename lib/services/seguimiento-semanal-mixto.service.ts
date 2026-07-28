import type { Prisma } from '@prisma/client'

import { MODALIDAD_MENSUAL_MIXTA } from '@/lib/payroll/cierreMensualMixto'
import { validarFechasDesgloseSemanal } from '@/lib/payroll/seguimientoSemanalMixto'
import { reconstruirLiquidacionCalculada } from '@/lib/payroll/validacionLiquidacion'
import { prisma } from '@/lib/prisma'
import { instanteRRHH, rangoDiasRRHH } from '@/lib/rrhh/fechas'
import { PayrollService } from '@/lib/services/payroll.service'

export class SeguimientoSemanalMixtoService {
    static async guardar(input: {
        empleadoId: string
        fechaInicio: string
        fechaFin: string
        calculatedData: unknown
        usuarioId: string
    }) {
        const data = input.calculatedData as Record<string, unknown> | null
        const dias = Array.isArray(data?.desglosePorDia)
            ? data.desglosePorDia as Array<Record<string, unknown>>
            : []
        const fechas = validarFechasDesgloseSemanal(input.fechaInicio, input.fechaFin, dias)
        const empleado = await prisma.empleado.findUnique({
            where: { id: input.empleadoId },
            select: { id: true, activo: true, modalidadPago: true },
        })
        if (!empleado?.activo || empleado.modalidadPago !== MODALIDAD_MENSUAL_MIXTA) {
            throw new Error('El empleado no está activo o no utiliza la modalidad mensual mixta.')
        }

        const calculoServidor = await PayrollService.calcularSueldoSemanal(
            input.empleadoId,
            input.fechaInicio,
            input.fechaFin,
        )
        const ajuste = Number(data?.ajusteHorasExtras || 0)
        if (ajuste !== 0) {
            throw new Error('Los seguimientos mixtos admiten ajustes por día, no ajustes globales de horas.')
        }
        const jornalServidor = calculoServidor.desglosePorDia[0]?.jornalBase || 0
        reconstruirLiquidacionCalculada(
            { desglosePorDia: dias as never[], ajusteHorasExtras: 0 },
            jornalServidor,
            calculoServidor.valorHoraExtra,
        )

        const rango = rangoDiasRRHH(input.fechaInicio, input.fechaFin)
        return prisma.$transaction(async tx => {
            const lockKey = `seguimiento-mixto:${input.empleadoId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`
            const existentes = await tx.seguimientoDiarioMixto.findMany({
                where: {
                    empleadoId: input.empleadoId,
                    fecha: { gte: rango.gte, lt: rango.lt },
                },
                select: { fecha: true, cierreMensualId: true },
            })
            const bloqueadas = new Set(
                existentes
                    .filter(registro => registro.cierreMensualId)
                    .map(registro => registro.fecha.toISOString().slice(0, 10)),
            )

            let guardados = 0
            for (const [indice, dia] of dias.entries()) {
                const fecha = fechas[indice]
                if (bloqueadas.has(fecha)) continue
                const horasTrabajadas = Number(dia.horasTrabajadas)
                const horasExtras = Number(dia.horasExtras)
                const valorDiaBase = Number(dia.valorDiaBase)
                const valorExtra = Number(dia.valorExtra)
                const valorFeriado = Number(dia.valorFeriado)
                const totalDia = Math.round((valorDiaBase + valorExtra + valorFeriado) * 100) / 100
                const detalle = { ...dia, fecha, totalDia } as Prisma.InputJsonObject
                await tx.seguimientoDiarioMixto.upsert({
                    where: {
                        empleadoId_fecha: {
                            empleadoId: input.empleadoId,
                            fecha: instanteRRHH(fecha),
                        },
                    },
                    create: {
                        empleadoId: input.empleadoId,
                        registradoPorId: input.usuarioId,
                        fecha: instanteRRHH(fecha),
                        semanaDesde: instanteRRHH(input.fechaInicio),
                        semanaHasta: instanteRRHH(input.fechaFin),
                        horasTrabajadas,
                        horasNormales: Math.max(0, horasTrabajadas - horasExtras),
                        horasExtras,
                        horasFeriado: dia.esFeriado ? horasTrabajadas : 0,
                        valorDiaBase,
                        valorExtra,
                        valorFeriado,
                        totalDia,
                        detalle,
                    },
                    update: {
                        registradoPorId: input.usuarioId,
                        registradoAt: new Date(),
                        semanaDesde: instanteRRHH(input.fechaInicio),
                        semanaHasta: instanteRRHH(input.fechaFin),
                        horasTrabajadas,
                        horasNormales: Math.max(0, horasTrabajadas - horasExtras),
                        horasExtras,
                        horasFeriado: dia.esFeriado ? horasTrabajadas : 0,
                        valorDiaBase,
                        valorExtra,
                        valorFeriado,
                        totalDia,
                        detalle,
                    },
                })
                guardados += 1
            }

            return {
                guardados,
                bloqueados: bloqueadas.size,
                fechasBloqueadas: fechas.filter(fecha => bloqueadas.has(fecha)),
            }
        })
    }
}
