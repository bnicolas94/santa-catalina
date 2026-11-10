import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Usuario = { id?: string; rol?: string; permisos?: { permisoStock?: boolean; permisoCompras?: boolean } }

async function usuarioCentral() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: NextResponse.json({ error: 'Sesión requerida' }, { status: 401 }) }
    const user = session.user as Usuario
    if (user.rol !== 'ADMIN' && !user.permisos?.permisoStock && !user.permisos?.permisoCompras) {
        return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
    }
    return { user }
}

const include = {
    ubicacion: { select: { id: true, nombre: true } },
    responsable: { select: { nombre: true, apellido: true } },
    detalles: { include: { insumo: { select: { nombre: true, unidadMedida: true } }, historialEstados: { orderBy: { createdAt: 'desc' as const }, take: 5, include: { empleado: { select: { nombre: true, apellido: true } } } } }, orderBy: { insumo: { nombre: 'asc' as const } } },
} as const

export async function GET() {
    const acceso = await usuarioCentral()
    if (acceso.error) return acceso.error
    const [recientes, abiertos] = await Promise.all([
        prisma.reporteStockSucursal.findMany({ where: { estado: 'enviado' }, orderBy: { enviadoAt: 'desc' }, take: 100, include }),
        prisma.reporteStockSucursal.findMany({ where: { estado: 'enviado', detalles: { some: { estadoReposicion: { in: ['pendiente', 'preparado'] } } } }, orderBy: { enviadoAt: 'desc' }, include }),
    ])
    const reportes = [...new Map([...abiertos, ...recientes].map((reporte) => [reporte.id, reporte])).values()]
        .sort((a, b) => (b.enviadoAt?.getTime() || 0) - (a.enviadoAt?.getTime() || 0))
    const ubicacionIds = [...new Set(reportes.map((reporte) => reporte.ubicacionId))]
    const insumoIds = [...new Set(reportes.flatMap((reporte) => reporte.detalles.map((detalle) => detalle.insumoId)))]
    const stocks = ubicacionIds.length && insumoIds.length ? await prisma.stockInsumo.findMany({
        where: { ubicacionId: { in: ubicacionIds }, insumoId: { in: insumoIds } },
        select: { ubicacionId: true, insumoId: true, cantidad: true },
    }) : []
    return NextResponse.json({ reportes, stocks })
}

export async function PATCH(request: Request) {
    const acceso = await usuarioCentral()
    if (acceso.error) return acceso.error
    try {
        const body = await request.json() as { detalleId?: unknown; estado?: unknown }
        if (typeof body.detalleId !== 'string' || !['pendiente', 'preparado', 'entregado'].includes(String(body.estado))) {
            return NextResponse.json({ error: 'Estado o detalle inválido' }, { status: 400 })
        }
        const estado = body.estado as string
        const detalle = await prisma.$transaction(async (tx) => {
            const actual = await tx.reporteStockSucursalDetalle.findUnique({ where: { id: body.detalleId as string }, include: { reporte: { select: { estado: true } } } })
            if (!actual || actual.reporte.estado !== 'enviado' || !actual.cantidadSolicitada || actual.cantidadSolicitada <= 0) throw new Error('La solicitud no está disponible')
            if (actual.estadoReposicion === estado) return actual
            const actualizado = await tx.reporteStockSucursalDetalle.updateMany({ where: { id: actual.id, estadoReposicion: actual.estadoReposicion }, data: { estadoReposicion: estado } })
            if (actualizado.count !== 1) throw new Error('El estado cambió en otra sesión. Actualizá la página.')
            await tx.estadoReposicionSucursal.create({ data: { detalleId: actual.id, empleadoId: acceso.user!.id || null, anterior: actual.estadoReposicion, nuevo: estado } })
            return tx.reporteStockSucursalDetalle.findUniqueOrThrow({ where: { id: actual.id } })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        return NextResponse.json(detalle)
    } catch (error) {
        const conflicto = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
        return NextResponse.json({ error: conflicto ? 'El estado cambió en otra sesión' : error instanceof Error ? error.message : 'No se pudo cambiar el estado' }, { status: conflicto ? 409 : 400 })
    }
}
