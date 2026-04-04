import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/liquidaciones/borrador?fechaInicio=...&fechaFin=...
// Recupera borradores existentes para un periodo
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const periodo = searchParams.get('periodo')

        if (!periodo) {
            return NextResponse.json({ error: 'Falta periodo' }, { status: 400 })
        }

        const borradores = await prisma.liquidacionSueldo.findMany({
            where: {
                estado: 'borrador',
                periodo: periodo
            }
        })

        return NextResponse.json(borradores)
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener borradores' }, { status: 500 })
    }
}

// POST /api/liquidaciones/borrador
// Guarda o actualiza un borrador
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, periodo, calculatedData } = body

        // Buscamos si ya existe un borrador para este empleado y periodo
        const existente = await prisma.liquidacionSueldo.findFirst({
            where: {
                empleadoId,
                periodo,
                estado: 'borrador'
            }
        })

        const data = {
            empleadoId,
            periodo,
            sueldoProporcional: calculatedData.sueldoBase || 0,
            horasNormales: calculatedData.horasNormales || 0,
            montoHorasNormales: calculatedData.montoHorasNormales || 0,
            horasExtras: calculatedData.horasExtras || 0,
            montoHorasExtras: calculatedData.montoHorasExtras || 0,
            horasFeriado: calculatedData.horasFeriado || 0,
            montoHorasFeriado: calculatedData.montoHorasFeriado || 0,
            ajusteHorasExtras: calculatedData.ajusteHorasExtras || 0,
            descuentosPrestamos: calculatedData.descuentoPrestamos || 0,
            totalNeto: calculatedData.totalNeto || 0,
            estado: 'borrador',
            desglose: calculatedData.desglosePorDia || null
        }

        if (existente) {
            const borrador = await prisma.liquidacionSueldo.update({
                where: { id: existente.id },
                data
            })
            return NextResponse.json(borrador)
        } else {
            const borrador = await prisma.liquidacionSueldo.create({ data })
            return NextResponse.json(borrador, { status: 201 })
        }
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Error al guardar borrador' }, { status: 500 })
    }
}
