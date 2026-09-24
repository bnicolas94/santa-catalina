import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fechaClaveRRHH } from '@/lib/rrhh/fechas'
import { consultarDatosConstancia } from '@/lib/rrhh/uniformes-config'
import { faltantesConstanciaUniformes } from '@/lib/rrhh/uniformes'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar la constancia.' }, { status: 403 })
    try {
        const { id } = await params
        const empleado = await prisma.empleado.findUnique({
            where: { id },
            select: {
                nombre: true, apellido: true, dni: true, rol: true, ubicacionId: true, puestoId: true,
                puesto: { select: { nombre: true } },
            },
        })
        if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado.' }, { status: 404 })
        const [configuracion, entregas] = await Promise.all([
            consultarDatosConstancia(empleado.ubicacionId, empleado.puestoId),
            prisma.entregaUniforme.findMany({
                where: { empleadoId: id, estado: 'ACTIVA' },
                orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
                select: {
                    id: true, fecha: true, observaciones: true, remera: true, buzo: true,
                    detalles: { select: { prenda: true, talle: true, cantidad: true, tipoModelo: true, marca: true, certificado: true } },
                },
            }),
        ])
        const filas = entregas.flatMap(entrega => entrega.detalles.map(detalle => ({
            entregaId: entrega.id,
            fecha: fechaClaveRRHH(entrega.fecha),
            producto: detalle.prenda === 'REMERA' ? 'Remera' : 'Buzo',
            talle: detalle.talle,
            tipoModelo: detalle.tipoModelo,
            marca: detalle.marca,
            certificado: detalle.certificado,
            cantidad: detalle.cantidad,
            observaciones: entrega.observaciones,
        })))
        const historicasSinDetalle = entregas.filter(entrega => entrega.detalles.length === 0).length
        const faltantes = faltantesConstanciaUniformes({
            ...configuracion,
            dni: empleado.dni,
            puesto: empleado.puesto?.nombre || null,
            filas,
        })
        return NextResponse.json({
            empleado: {
                nombreCompleto: [empleado.nombre, empleado.apellido].filter(Boolean).join(' '),
                dni: empleado.dni,
                puesto: empleado.puesto?.nombre || '',
            },
            ...configuracion,
            filas,
            historicasSinDetalle,
            faltantes,
        })
    } catch {
        return NextResponse.json({ error: 'No se pudo preparar la constancia.' }, { status: 500 })
    }
}
