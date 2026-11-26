import { prisma } from '@/lib/prisma'
import { calcularConciliacionInsumos } from '@/lib/reportes/conciliacion-insumos'

export async function listarConteosParaConciliacion(ubicacionId: string) {
    const sede = await prisma.ubicacion.findUnique({ where: { id: ubicacionId }, select: { id: true, nombre: true, tipo: true } })
    if (!sede || sede.tipo !== 'FABRICA') throw new Error('Seleccioná una fábrica para comparar conteos.')
    const conteos = await prisma.conteoInsumo.findMany({
        where: { ubicacionId, estado: 'confirmado', detalles: { some: {} } },
        select: { id: true, fecha: true, _count: { select: { detalles: true } } },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    })
    return { sede, conteos: conteos.map(c => ({ id: c.id, fecha: c.fecha, insumos: c._count.detalles })) }
}

export async function obtenerConciliacionInsumos(ubicacionId: string, inicioId: string, finId: string) {
    const seleccion = await prisma.conteoInsumo.findMany({
        where: { id: { in: [inicioId, finId] }, ubicacionId, estado: 'confirmado', ubicacion: { tipo: 'FABRICA' } },
        select: { id: true, fecha: true, ubicacion: { select: { nombre: true } },
            detalles: { select: { insumoId: true, cantidadContada: true,
                insumo: { select: { nombre: true, unidadMedida: true, precioUnitario: true } } } } },
    })
    const inicial = seleccion.find(c => c.id === inicioId)
    const final = seleccion.find(c => c.id === finId)
    if (!inicial || !final || inicioId === finId) throw new Error('Elegí dos conteos confirmados de la misma fábrica.')
    const duracion = final.fecha.getTime() - inicial.fecha.getTime()
    if (duracion <= 0) throw new Error('El conteo final debe ser posterior al inicial.')
    if (duracion > 366 * 86_400_000) throw new Error('Elegí conteos separados por un máximo de 366 días.')
    const ids = [...new Set(inicial.detalles.map(d => d.insumoId).filter(id => final.detalles.some(d => d.insumoId === id)))]
    const movimientos = ids.length ? await prisma.movimientoStock.findMany({
        where: { insumoId: { in: ids }, fecha: { gt: inicial.fecha, lt: final.fecha },
            OR: [{ ubicacionId }, { ubicacionId: null, loteOrigen: { ubicacionId } }] },
        select: { insumoId: true, tipo: true, cantidad: true, loteOrigenId: true,
            detalleConteo: { select: { id: true } } },
    }) : []
    return { sede: inicial.ubicacion.nombre, inicio: { id: inicial.id, fecha: inicial.fecha },
        fin: { id: final.id, fecha: final.fecha }, ...calcularConciliacionInsumos(inicial, final, movimientos) }
}
