import { prisma } from '@/lib/prisma'
import { calcularConciliacionInsumos } from '@/lib/reportes/conciliacion-insumos'
import { calcularProductMix } from '@/lib/reportes/product-mix'
import { diasPersonalizadosEntreConteos, resumirPersonalizadosParaConteo } from '@/lib/reportes/conciliacion-personalizados'
import { cargarProductosReceta } from '@/lib/services/reportes-consumo-pedidos'
import { obtenerReportePedidosConjunto } from '@/lib/services/reportes-pedidos-conjunto'

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
    const periodoPersonalizados = diasPersonalizadosEntreConteos(inicial.fecha, final.fecha)
    const fabricas = await prisma.ubicacion.count({ where: { tipo: 'FABRICA' } })
    let personalizados: {
        estado: 'incluidos' | 'parcial' | 'sin_dias_completos' | 'sin_asignacion' | 'sin_fuente'
        desde: string | null; hasta: string | null; pedidos: number; paquetes: number;
        filasPendientes: number; faltantes: string[]; sinConteo: string[];
        insumos: { id: string; nombre: string; unidad: string; cantidad: number }[]
    } = { estado: 'incluidos', desde: periodoPersonalizados?.desde ?? null,
        hasta: periodoPersonalizados?.hasta ?? null, pedidos: 0, paquetes: 0,
        filasPendientes: 0, faltantes: [], sinConteo: [], insumos: [] }
    if (!periodoPersonalizados) {
        personalizados.estado = 'sin_dias_completos'
        personalizados.faltantes = ['Ambos conteos son del mismo día: el Sheet no indica a qué hora se preparó el pedido.']
    } else if (fabricas !== 1) {
        personalizados.estado = 'sin_asignacion'
        personalizados.faltantes = ['Hay más de una fábrica o ninguna: el Sheet no identifica cuál elaboró cada personalizado.']
    } else {
        try {
            const [reporte, productos] = await Promise.all([
                obtenerReportePedidosConjunto({ desde: periodoPersonalizados.desde, hasta: periodoPersonalizados.hasta, todos: true }),
                cargarProductosReceta(),
            ])
            const resumen = resumirPersonalizadosParaConteo(reporte, calcularProductMix(reporte, productos))
            const faltantes = [...resumen.faltantes]
            if (reporte.calidad.sinSaboresElegidos) faltantes.push(`${reporte.calidad.sinSaboresElegidos} pedidos personalizados sin sabores válidos`)
            if (reporte.calidad.sinPaquetes) faltantes.push(`${reporte.calidad.sinPaquetes} pedidos entregados sin producto o cantidad clasificable`)
            if (reporte.calidad.conflictos) faltantes.push(`${reporte.calidad.conflictos} IDs con datos contradictorios en el Sheet`)
            personalizados = { ...resumen, desde: periodoPersonalizados.desde, hasta: periodoPersonalizados.hasta,
                estado: faltantes.length ? 'parcial' : 'incluidos', faltantes,
                sinConteo: resumen.insumos.filter(item => !ids.includes(item.id)).map(item => item.nombre) }
        } catch (error) {
            console.error('No se pudieron consultar personalizados para conciliación:', error)
            personalizados.estado = 'sin_fuente'
            personalizados.faltantes = ['No se pudieron consultar los pedidos personalizados del Sheet.']
        }
    }
    return { sede: inicial.ubicacion.nombre, inicio: { id: inicial.id, fecha: inicial.fecha },
        fin: { id: final.id, fecha: final.fecha }, personalizados,
        ...calcularConciliacionInsumos(inicial, final, movimientos, personalizados.insumos) }
}
