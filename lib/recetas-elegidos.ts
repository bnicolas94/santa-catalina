import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { saboresSheetOnline } from '@/lib/pedidos-online-excel'
import { cantidadParaGuardar, cantidadParaPlancha } from '@/lib/recetas-elegidos-unidades'

export type AlcanceRecetaElegidos = 'base' | 'sabor' | 'empaque'

const saboresPorCodigo = new Map<string, { codigo: string; nombre: string }>()
for (const [nombre, codigo] of Object.entries(saboresSheetOnline)) {
    if (!saboresPorCodigo.has(codigo)) saboresPorCodigo.set(codigo, { codigo, nombre: nombre.replace(/\b\w/g, letra => letra.toUpperCase()) })
}
export const saboresConfigurables = [...saboresPorCodigo.values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

export function validarLineaElegidos(input: {
    alcance: string; codigoSabor?: string; presentacionId?: string; insumoId?: string;
    cantidad?: number; merma?: number
}) {
    if (!['base', 'sabor', 'empaque'].includes(input.alcance)) throw new Error('Elegí base, sabor o empaque.')
    if (!input.insumoId) throw new Error('Seleccioná un insumo.')
    if (!Number.isFinite(input.cantidad) || (input.cantidad ?? 0) <= 0) throw new Error('La cantidad debe ser mayor a cero.')
    if (!Number.isFinite(input.merma) || (input.merma ?? 0) < 0 || (input.merma ?? 0) >= 100) throw new Error('La merma debe estar entre 0 y 99,99%.')
    if (input.alcance === 'sabor' && !saboresConfigurables.some(s => s.codigo === input.codigoSabor)) throw new Error('El sabor no figura en el Sheet online.')
    if (input.alcance === 'empaque' && !input.presentacionId) throw new Error('Seleccioná la presentación del empaque.')
    return {
        alcance: input.alcance as AlcanceRecetaElegidos,
        insumoId: input.insumoId, cantidad: input.cantidad!, merma: input.merma!,
        codigoSabor: input.alcance === 'sabor' ? input.codigoSabor! : null,
        presentacionId: input.alcance === 'empaque' ? input.presentacionId! : null,
    }
}

export async function obtenerRecetasElegidos(productoId: string) {
    const producto = await prisma.producto.findUnique({
        where: { id: productoId },
        select: { id: true, codigoInterno: true, presentaciones: { select: { id: true, cantidad: true }, orderBy: { cantidad: 'asc' } },
            recetasElegidos: { include: { insumo: { select: { id: true, nombre: true, unidadMedida: true, precioUnitario: true } },
                variante: { select: { codigo: true } }, presentacion: { select: { cantidad: true } } },
                orderBy: [{ alcance: 'asc' }, { createdAt: 'asc' }] } },
    })
    if (!producto || producto.codigoInterno !== 'ELE') throw new Error('Este producto no es Elegidos.')
    const insumos = await prisma.insumo.findMany({ where: { activo: true },
        select: { id: true, nombre: true, unidadMedida: true, precioUnitario: true }, orderBy: { nombre: 'asc' } })
    return { ...producto, recetasElegidos: producto.recetasElegidos.map(linea => ({
        ...linea, cantidad: cantidadParaPlancha(linea.alcance, linea.cantidad),
    })), sabores: saboresConfigurables, insumos }
}

export async function guardarLineaElegidos(productoId: string, raw: unknown, id?: string) {
    if (!raw || typeof raw !== 'object') throw new Error('Datos de receta inválidos.')
    const body = raw as Record<string, unknown>
    const input = validarLineaElegidos({
        alcance: String(body.alcance ?? ''), codigoSabor: String(body.codigoSabor ?? ''),
        presentacionId: String(body.presentacionId ?? ''), insumoId: String(body.insumoId ?? ''),
        cantidad: Number(body.cantidad), merma: Number(body.merma ?? 0),
    })
    return prisma.$transaction(async tx => {
        const [producto, insumo, anterior] = await Promise.all([
            tx.producto.findUnique({ where: { id: productoId }, select: { codigoInterno: true } }),
            tx.insumo.findUnique({ where: { id: input.insumoId }, select: { activo: true } }),
            id ? tx.recetaElegidosInsumo.findFirst({ where: { id, productoId }, select: { id: true } }) : Promise.resolve(null),
        ])
        if (!producto || producto.codigoInterno !== 'ELE') throw new Error('Este producto no es Elegidos.')
        if (!insumo?.activo) throw new Error('El insumo no existe o está inactivo.')
        if (id && !anterior) throw new Error('La línea de receta no existe en este producto.')
        let varianteId: string | null = null
        if (input.codigoSabor) {
            const etiqueta = saboresConfigurables.find(s => s.codigo === input.codigoSabor)!.nombre
            const variante = await tx.varianteProducto.upsert({
                where: { productoId_codigo: { productoId, codigo: input.codigoSabor } },
                create: { productoId, codigo: input.codigoSabor, nombre: etiqueta },
                update: { nombre: etiqueta, activo: true }, select: { id: true },
            })
            varianteId = variante.id
        }
        if (input.presentacionId) {
            const presentacion = await tx.presentacion.findFirst({ where: { id: input.presentacionId, productoId }, select: { id: true } })
            if (!presentacion) throw new Error('La presentación no pertenece a Elegidos.')
        }
        const claveAlcance = input.alcance === 'base' ? 'base'
            : input.alcance === 'sabor' ? `sabor:${input.codigoSabor}` : `empaque:${input.presentacionId}`
        const data = { productoId, insumoId: input.insumoId, alcance: input.alcance, claveAlcance,
            varianteId, presentacionId: input.presentacionId,
            cantidad: cantidadParaGuardar(input.alcance, input.cantidad), merma: input.merma }
        const linea = id ? await tx.recetaElegidosInsumo.update({ where: { id }, data })
            : await tx.recetaElegidosInsumo.create({ data })
        return { ...linea, cantidad: cantidadParaPlancha(linea.alcance, linea.cantidad) }
    })
}

export async function quitarLineaElegidos(productoId: string, id: string) {
    const resultado = await prisma.recetaElegidosInsumo.deleteMany({ where: { id, productoId } })
    if (!resultado.count) throw new Error('La línea de receta no existe en este producto.')
}

export function mensajeRecetaElegidos(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'Ese insumo ya está cargado para el mismo alcance.'
    return error instanceof Error ? error.message : 'No se pudo guardar la receta.'
}
