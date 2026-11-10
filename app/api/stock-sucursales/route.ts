import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fechaLocalArgentina, leerReporteInput } from '@/lib/stock-sucursales'

type Usuario = { id?: string; ubicacionId?: string | null; ubicacionTipo?: string | null }

async function sedeDelUsuario() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: NextResponse.json({ error: 'Sesión requerida' }, { status: 401 }) }
    const user = session.user as Usuario
    if (!user.id || !user.ubicacionId || user.ubicacionTipo?.toUpperCase() !== 'LOCAL') {
        return { error: NextResponse.json({ error: 'Se requiere una sucursal asignada' }, { status: 403 }) }
    }
    const sede = await prisma.ubicacion.findFirst({ where: { id: user.ubicacionId, tipo: 'LOCAL', activo: true }, select: { id: true, nombre: true } })
    if (!sede) return { error: NextResponse.json({ error: 'La sucursal asignada no está activa' }, { status: 403 }) }
    return { user, sede }
}

const reporteInclude = {
    detalles: { include: { insumo: { select: { id: true, nombre: true, unidadMedida: true } } }, orderBy: { insumo: { nombre: 'asc' as const } } },
    responsable: { select: { nombre: true, apellido: true } },
} as const

export async function GET() {
    const acceso = await sedeDelUsuario()
    if (acceso.error) return acceso.error
    const fechaLocal = fechaLocalArgentina()
    const [insumos, reporte, historial] = await Promise.all([
        prisma.insumo.findMany({ where: { activo: true }, select: { id: true, nombre: true, unidadMedida: true, familia: { select: { nombre: true } } }, orderBy: { nombre: 'asc' } }),
        prisma.reporteStockSucursal.findUnique({ where: { ubicacionId_fechaLocal: { ubicacionId: acceso.sede!.id, fechaLocal } }, include: reporteInclude }),
        prisma.reporteStockSucursal.findMany({ where: { ubicacionId: acceso.sede!.id, estado: 'enviado' }, orderBy: { enviadoAt: 'desc' }, take: 20, include: reporteInclude }),
    ])
    return NextResponse.json({ sede: acceso.sede, fechaLocal, insumos, reporte, historial })
}

export async function PUT(request: Request) {
    const acceso = await sedeDelUsuario()
    if (acceso.error) return acceso.error
    try {
        const input = leerReporteInput(await request.json())
        const fechaLocal = fechaLocalArgentina()
        const ids = input.detalles.map((item) => item.insumoId)
        const reporte = await prisma.$transaction(async (tx) => {
            const insumosValidos = await tx.insumo.count({ where: { id: { in: ids }, activo: true } })
            if (insumosValidos !== ids.length) throw new Error('Uno o más insumos ya no están activos')
            const where = { ubicacionId_fechaLocal: { ubicacionId: acceso.sede!.id, fechaLocal } }
            const actual = await tx.reporteStockSucursal.findUnique({ where })
            if (actual?.estado === 'enviado') throw new Error('El reporte de hoy ya fue enviado')
            if ((actual?.version || 0) !== input.version) throw new Error('El reporte cambió en otra sesión. Actualizá la página.')
            let id: string
            if (actual) {
                const updated = await tx.reporteStockSucursal.updateMany({
                    where: { id: actual.id, version: input.version, estado: 'borrador' },
                    data: { observaciones: input.observaciones, responsableId: acceso.user!.id, version: { increment: 1 } },
                })
                if (updated.count !== 1) throw new Error('El reporte cambió en otra sesión. Actualizá la página.')
                id = actual.id
                await tx.reporteStockSucursalDetalle.deleteMany({ where: { reporteId: id } })
            } else {
                const creado = await tx.reporteStockSucursal.create({ data: {
                    fechaLocal, ubicacionId: acceso.sede!.id, responsableId: acceso.user!.id, observaciones: input.observaciones,
                } })
                id = creado.id
            }
            if (input.detalles.length) await tx.reporteStockSucursalDetalle.createMany({ data: input.detalles.map((item) => ({
                reporteId: id, insumoId: item.insumoId, cantidadInformada: item.cantidadInformada, cantidadSolicitada: item.cantidadSolicitada,
                estadoReposicion: item.cantidadSolicitada && item.cantidadSolicitada > 0 ? 'pendiente' : null,
            })) })
            return tx.reporteStockSucursal.findUniqueOrThrow({ where: { id }, include: reporteInclude })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        return NextResponse.json(reporte)
    } catch (error) {
        const conflicto = error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)
        return NextResponse.json({ error: conflicto ? 'El reporte cambió en otra sesión. Actualizá la página.' : error instanceof Error ? error.message : 'No se pudo guardar el reporte' }, { status: conflicto || (error instanceof Error && /cambió|ya fue enviado/.test(error.message)) ? 409 : 400 })
    }
}

export async function POST(request: Request) {
    const acceso = await sedeDelUsuario()
    if (acceso.error) return acceso.error
    try {
        const body = await request.json() as { version?: unknown }
        if (!Number.isInteger(body?.version)) throw new Error('Versión de reporte inválida')
        const fechaLocal = fechaLocalArgentina()
        const reporte = await prisma.$transaction(async (tx) => {
            const actual = await tx.reporteStockSucursal.findUnique({ where: { ubicacionId_fechaLocal: { ubicacionId: acceso.sede!.id, fechaLocal } }, include: { detalles: true } })
            if (!actual || actual.estado !== 'borrador' || actual.version !== body.version) throw new Error('Actualizá el reporte antes de enviarlo')
            if (!actual.detalles.length) throw new Error('Cargá al menos un insumo antes de enviar')
            const result = await tx.reporteStockSucursal.updateMany({ where: { id: actual.id, version: actual.version, estado: 'borrador' }, data: { estado: 'enviado', enviadoAt: new Date(), version: { increment: 1 } } })
            if (result.count !== 1) throw new Error('El reporte cambió en otra sesión')
            return tx.reporteStockSucursal.findUniqueOrThrow({ where: { id: actual.id }, include: reporteInclude })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        return NextResponse.json(reporte)
    } catch (error) {
        const conflicto = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
        return NextResponse.json({ error: conflicto ? 'El reporte cambió en otra sesión' : error instanceof Error ? error.message : 'No se pudo enviar' }, { status: conflicto ? 409 : 400 })
    }
}
