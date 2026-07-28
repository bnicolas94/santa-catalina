import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
    calcularPagoHorasAdeudadas,
    etiquetaSemanaOrigen,
    semanaLaboralDeOrigen,
    valorHoraExtraAdeudada,
} from '@/lib/payroll/horasExtrasAdeudadas'
import { fechaClaveRRHH, instanteRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

function mensajeError(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo procesar la solicitud.'
}

export async function GET() {
    try {
        const [pendientes, empleados] = await Promise.all([
            prisma.horaExtraPendiente.findMany({
                where: { pagado: false },
                include: { empleado: { select: { nombre: true, apellido: true, dni: true, activo: true } } },
                orderBy: [{ fechaOrigen: 'desc' }, { empleado: { nombre: 'asc' } }],
            }),
            prisma.empleado.findMany({
                where: { activo: true },
                include: { rolRel: true },
                orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
            }),
        ])

        return NextResponse.json({
            pendientes: pendientes.map(pendiente => ({
                id: pendiente.id,
                empleadoId: pendiente.empleadoId,
                empleadoNombre: `${pendiente.empleado.nombre} ${pendiente.empleado.apellido || ''}`.trim(),
                empleadoDni: pendiente.empleado.dni,
                empleadoActivo: pendiente.empleado.activo,
                cantidadHoras: pendiente.cantidadHoras,
                montoCalculado: pendiente.montoCalculado,
                fechaOrigen: fechaClaveRRHH(pendiente.fechaOrigen),
                periodoOrigen: etiquetaSemanaOrigen(fechaClaveRRHH(pendiente.fechaOrigen)),
                observaciones: pendiente.observaciones,
            })),
            valoresHora: Object.fromEntries(
                empleados.map(empleado => [empleado.id, valorHoraExtraAdeudada(empleado)]),
            ),
        })
    } catch (error) {
        console.error('Error obteniendo horas extras adeudadas:', error)
        return NextResponse.json({ error: 'No se pudieron cargar las horas extras adeudadas.' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as Record<string, unknown>
        const empleadoId = typeof body.empleadoId === 'string' ? body.empleadoId : ''
        const fechaInformada = typeof body.fechaOrigen === 'string' ? body.fechaOrigen : ''
        const cantidadHoras = typeof body.cantidadHoras === 'number'
            ? body.cantidadHoras
            : Number(body.cantidadHoras)
        const observaciones = typeof body.observaciones === 'string' && body.observaciones.trim()
            ? body.observaciones.trim().slice(0, 500)
            : null

        if (!empleadoId || !fechaInformada) {
            return NextResponse.json({ error: 'Seleccioná un empleado y la semana de origen.' }, { status: 400 })
        }

        const fechaOrigen = validarFechaCivilRRHH(fechaInformada)
        const semanaOrigen = semanaLaboralDeOrigen(fechaOrigen)
        const semanaActual = semanaLaboralDeOrigen(fechaClaveRRHH(new Date()))
        if (semanaOrigen.desde >= semanaActual.desde) {
            return NextResponse.json({
                error: 'La semana de origen debe ser anterior a la semana en curso.',
            }, { status: 400 })
        }

        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            include: { rolRel: true },
        })
        if (!empleado || !empleado.activo) {
            return NextResponse.json({ error: 'El empleado no existe o está inactivo.' }, { status: 404 })
        }

        const valorHoraExtra = valorHoraExtraAdeudada(empleado)
        const montoCalculado = calcularPagoHorasAdeudadas(cantidadHoras, valorHoraExtra)
        const pendiente = await prisma.horaExtraPendiente.create({
            data: {
                empleadoId,
                cantidadHoras,
                montoCalculado,
                fechaOrigen: instanteRRHH(semanaOrigen.desde),
                observaciones,
            },
        })

        return NextResponse.json({
            id: pendiente.id,
            cantidadHoras: pendiente.cantidadHoras,
            montoCalculado: pendiente.montoCalculado,
            valorHoraExtra,
            periodoOrigen: etiquetaSemanaOrigen(semanaOrigen.desde),
        }, { status: 201 })
    } catch (error) {
        console.error('Error creando horas extras adeudadas:', error)
        return NextResponse.json({ error: mensajeError(error) }, { status: 400 })
    }
}

export async function DELETE(request: Request) {
    try {
        const id = new URL(request.url).searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'La deuda es requerida.' }, { status: 400 })

        const resultado = await prisma.horaExtraPendiente.deleteMany({ where: { id, pagado: false } })
        if (resultado.count === 0) {
            return NextResponse.json({ error: 'La deuda no existe o ya fue pagada.' }, { status: 404 })
        }
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error eliminando horas extras adeudadas:', error)
        return NextResponse.json({ error: 'No se pudo eliminar la deuda.' }, { status: 500 })
    }
}
