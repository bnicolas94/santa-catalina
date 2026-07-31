import { prisma } from '@/lib/prisma'

type FichaCosto = {
    cantidadPorUnidad: number
    merma?: number | null
    insumo: { precioUnitario: number }
}

export type TipoMerma = 'insumo' | 'producto'

export type RegistrarMermaInput = {
    tipo: TipoMerma
    ubicacionId: string
    cantidad: number
    fecha?: string
    motivo: string
    observaciones?: string
    insumoId?: string
    productoId?: string
    presentacionId?: string
}

export function calcularCostoReceta(fichas: FichaCosto[]) {
    return fichas.reduce((total, ficha) => {
        const mermaPct = Math.min(Math.max(ficha.merma || 0, 0), 99.99)
        const cantidadReal = ficha.cantidadPorUnidad / (1 - mermaPct / 100)
        return total + cantidadReal * (ficha.insumo.precioUnitario || 0)
    }, 0)
}

export function extraerMotivoMerma(observaciones?: string | null) {
    if (!observaciones) return 'Sin especificar'
    const partes = observaciones.split(/\s[—–-]\s/)
    return (partes.at(-1) || observaciones).trim() || 'Sin especificar'
}

export function calcularResultadoConMerma(
    margenBruto: number,
    gastosOperativos: number,
    perdidaPorMerma: number,
    usaComprasComoCmv: boolean
) {
    const mermaImpactaResultado = !usaComprasComoCmv
    return {
        mermaImpactaResultado,
        rentabilidadNeta: margenBruto - gastosOperativos - (mermaImpactaResultado ? perdidaPorMerma : 0)
    }
}

function fechaRegistro(fecha?: string) {
    if (!fecha) return new Date()
    const parsed = new Date(`${fecha}T12:00:00Z`)
    if (Number.isNaN(parsed.getTime())) throw new Error('La fecha ingresada no es válida')
    return parsed
}

function textoObservaciones(motivo: string, observaciones?: string) {
    return observaciones?.trim()
        ? `Merma — ${motivo}. ${observaciones.trim()}`
        : `Merma — ${motivo}`
}

function validarInput(input: RegistrarMermaInput) {
    if (!['insumo', 'producto'].includes(input.tipo)) throw new Error('Tipo de merma inválido')
    if (!input.ubicacionId) throw new Error('La ubicación es obligatoria')
    if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) throw new Error('La cantidad debe ser mayor a cero')
    if (!input.motivo?.trim()) throw new Error('El motivo es obligatorio')
    if (input.motivo.length > 100) throw new Error('El motivo no puede superar los 100 caracteres')
    if ((input.observaciones?.length || 0) > 500) throw new Error('Las observaciones no pueden superar los 500 caracteres')
    if (input.tipo === 'insumo' && !input.insumoId) throw new Error('El insumo es obligatorio')
    if (input.tipo === 'producto' && (!input.productoId || !input.presentacionId)) {
        throw new Error('El producto y la presentación son obligatorios')
    }
}

export async function registrarMerma(input: RegistrarMermaInput) {
    validarInput(input)
    const fecha = fechaRegistro(input.fecha)
    const motivo = input.motivo.trim()
    const observaciones = textoObservaciones(motivo, input.observaciones)

    if (input.tipo === 'insumo') {
        return prisma.$transaction(async (tx) => {
            const insumo = await tx.insumo.findUnique({
                where: { id: input.insumoId! },
                select: {
                    id: true,
                    nombre: true,
                    precioUnitario: true,
                    stockActual: true,
                    stocks: {
                        where: { ubicacionId: input.ubicacionId },
                        select: { cantidad: true }
                    }
                }
            })
            if (!insumo) throw new Error('El insumo seleccionado no existe')

            const disponibleUbicacion = insumo.stocks[0]?.cantidad || 0
            if (disponibleUbicacion < input.cantidad) {
                throw new Error(`Stock insuficiente en la ubicación. Disponible: ${disponibleUbicacion}`)
            }
            if (insumo.stockActual < input.cantidad) {
                throw new Error(`Stock global insuficiente. Disponible: ${insumo.stockActual}`)
            }

            const costoTotal = input.cantidad * (insumo.precioUnitario || 0)
            const stockLocal = await tx.stockInsumo.updateMany({
                where: {
                    insumoId: input.insumoId!,
                    ubicacionId: input.ubicacionId,
                    cantidad: { gte: input.cantidad }
                },
                data: { cantidad: { decrement: input.cantidad } }
            })
            if (stockLocal.count !== 1) throw new Error('El stock cambió mientras se registraba la merma')

            const stockGlobal = await tx.insumo.updateMany({
                where: { id: input.insumoId!, stockActual: { gte: input.cantidad } },
                data: { stockActual: { decrement: input.cantidad } }
            })
            if (stockGlobal.count !== 1) throw new Error('El stock global cambió mientras se registraba la merma')

            const movimiento = await tx.movimientoStock.create({
                data: {
                    insumoId: input.insumoId!,
                    ubicacionId: input.ubicacionId,
                    tipo: 'merma',
                    cantidad: input.cantidad,
                    fecha,
                    motivoMerma: motivo,
                    observaciones,
                    costoTotal,
                    estadoPago: null
                }
            })

            return { id: movimiento.id, tipo: input.tipo, costoTotal }
        })
    }

    if (!Number.isInteger(input.cantidad)) throw new Error('La cantidad de producto debe expresarse en paquetes enteros')

    return prisma.$transaction(async (tx) => {
        const presentacion = await tx.presentacion.findFirst({
            where: { id: input.presentacionId!, productoId: input.productoId!, activo: true },
            include: {
                producto: {
                    include: {
                        fichasTecnicas: { include: { insumo: { select: { precioUnitario: true } } } }
                    }
                }
            }
        })
        if (!presentacion) throw new Error('El producto o la presentación seleccionada no existe')

        const stock = await tx.stockProducto.findUnique({
            where: {
                productoId_presentacionId_ubicacionId: {
                    productoId: input.productoId!,
                    presentacionId: input.presentacionId!,
                    ubicacionId: input.ubicacionId
                }
            },
            select: { cantidad: true }
        })
        if (!stock || stock.cantidad < input.cantidad) {
            throw new Error(`Stock insuficiente en la ubicación. Disponible: ${stock?.cantidad || 0} paquetes`)
        }

        const costoUnidadPresentacion = calcularCostoReceta(presentacion.producto.fichasTecnicas) * presentacion.cantidad
        const costoTotal = costoUnidadPresentacion * input.cantidad
        const actualizado = await tx.stockProducto.updateMany({
            where: {
                productoId: input.productoId!,
                presentacionId: input.presentacionId!,
                ubicacionId: input.ubicacionId,
                cantidad: { gte: input.cantidad }
            },
            data: { cantidad: { decrement: input.cantidad } }
        })
        if (actualizado.count !== 1) throw new Error('El stock cambió mientras se registraba la merma')

        const movimiento = await tx.movimientoProducto.create({
            data: {
                productoId: input.productoId!,
                presentacionId: input.presentacionId!,
                ubicacionId: input.ubicacionId,
                tipo: 'merma',
                signo: 'salida',
                cantidad: input.cantidad,
                fecha,
                motivoMerma: motivo,
                observaciones,
                costoUnitario: costoUnidadPresentacion,
                costoTotal
            }
        })

        return { id: movimiento.id, tipo: input.tipo, costoTotal }
    })
}

async function obtenerRegistros(desde: Date, hasta: Date, ubicacionId?: string) {
    const filtroUbicacion = ubicacionId ? { ubicacionId } : {}
    const [movimientosProducto, movimientosInsumo, lotes] = await Promise.all([
        prisma.movimientoProducto.findMany({
            where: { tipo: 'merma', signo: 'salida', fecha: { gte: desde, lte: hasta }, ...filtroUbicacion },
            include: {
                ubicacion: { select: { nombre: true } },
                presentacion: { select: { cantidad: true } },
                producto: {
                    select: {
                        nombre: true,
                        fichasTecnicas: { include: { insumo: { select: { precioUnitario: true } } } }
                    }
                }
            },
            orderBy: { fecha: 'desc' }
        }),
        prisma.movimientoStock.findMany({
            where: { tipo: 'merma', fecha: { gte: desde, lte: hasta }, ...filtroUbicacion },
            include: {
                ubicacion: { select: { nombre: true } },
                insumo: { select: { nombre: true, unidadMedida: true, precioUnitario: true } }
            },
            orderBy: { fecha: 'desc' }
        }),
        prisma.lote.findMany({
            where: {
                unidadesRechazadas: { gt: 0 },
                estado: { not: 'en_produccion' },
                fechaProduccion: { gte: desde, lte: hasta },
                ...filtroUbicacion
            },
            include: {
                ubicacion: { select: { nombre: true } },
                producto: {
                    select: {
                        nombre: true,
                        planchasPorPaquete: true,
                        fichasTecnicas: { include: { insumo: { select: { precioUnitario: true } } } }
                    }
                }
            },
            orderBy: { fechaProduccion: 'desc' }
        })
    ])

    const productos = movimientosProducto
        .filter(movimiento => !movimiento.loteId)
        .map(movimiento => {
            const costoCalculado = calcularCostoReceta(movimiento.producto.fichasTecnicas) * movimiento.presentacion.cantidad
            const costoUnitario = movimiento.costoUnitario ?? costoCalculado
            return {
                id: `producto-${movimiento.id}`,
                referenciaId: movimiento.id,
                fecha: movimiento.fecha,
                origen: 'producto_terminado',
                origenLabel: 'Producto terminado',
                item: movimiento.producto.nombre,
                cantidad: movimiento.cantidad,
                unidad: 'paq',
                ubicacion: movimiento.ubicacion.nombre,
                motivo: movimiento.motivoMerma || extraerMotivoMerma(movimiento.observaciones),
                observaciones: movimiento.observaciones || '',
                costoUnitario,
                costoTotal: movimiento.costoTotal ?? costoUnitario * movimiento.cantidad,
                costoHistorico: movimiento.costoTotal !== null
            }
        })

    const insumos = movimientosInsumo.map(movimiento => {
        const costoTotal = movimiento.costoTotal ?? movimiento.cantidad * (movimiento.insumo.precioUnitario || 0)
        return {
            id: `insumo-${movimiento.id}`,
            referenciaId: movimiento.id,
            fecha: movimiento.fecha,
            origen: 'insumo',
            origenLabel: 'Insumo',
            item: movimiento.insumo.nombre,
            cantidad: movimiento.cantidad,
            unidad: movimiento.insumo.unidadMedida,
            ubicacion: movimiento.ubicacion?.nombre || 'Sin ubicación',
            motivo: movimiento.motivoMerma || extraerMotivoMerma(movimiento.observaciones),
            observaciones: movimiento.observaciones || '',
            costoUnitario: movimiento.cantidad > 0 ? costoTotal / movimiento.cantidad : 0,
            costoTotal,
            costoHistorico: movimiento.costoTotal !== null
        }
    })

    const rechazosProduccion = lotes.map(lote => {
        const unidadesPorPaquete = (lote.producto.planchasPorPaquete || 6) * 8
        const costoUnitario = calcularCostoReceta(lote.producto.fichasTecnicas) * unidadesPorPaquete
        return {
            id: `lote-${lote.id}`,
            referenciaId: lote.id,
            fecha: lote.fechaProduccion,
            origen: 'produccion',
            origenLabel: 'Rechazo en producción',
            item: lote.producto.nombre,
            cantidad: lote.unidadesRechazadas,
            unidad: 'paq',
            ubicacion: lote.ubicacion.nombre,
            motivo: lote.motivoRechazo || 'Sin especificar',
            observaciones: lote.motivoRechazo || '',
            costoUnitario,
            costoTotal: costoUnitario * lote.unidadesRechazadas,
            costoHistorico: false
        }
    })

    return [...productos, ...insumos, ...rechazosProduccion]
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
}

function resumir(registros: Awaited<ReturnType<typeof obtenerRegistros>>) {
    const costoTotal = registros.reduce((total, registro) => total + registro.costoTotal, 0)
    const porOrigen = registros.reduce<Record<string, { origen: string; nombre: string; registros: number; costo: number }>>((acc, registro) => {
        if (!acc[registro.origen]) {
            acc[registro.origen] = { origen: registro.origen, nombre: registro.origenLabel, registros: 0, costo: 0 }
        }
        acc[registro.origen].registros += 1
        acc[registro.origen].costo += registro.costoTotal
        return acc
    }, {})
    const porMotivo = registros.reduce<Record<string, { motivo: string; registros: number; costo: number }>>((acc, registro) => {
        if (!acc[registro.motivo]) acc[registro.motivo] = { motivo: registro.motivo, registros: 0, costo: 0 }
        acc[registro.motivo].registros += 1
        acc[registro.motivo].costo += registro.costoTotal
        return acc
    }, {})

    return {
        costoTotal,
        totalRegistros: registros.length,
        estimados: registros.filter(registro => !registro.costoHistorico).length,
        porOrigen: Object.values(porOrigen).sort((a, b) => b.costo - a.costo),
        porMotivo: Object.values(porMotivo).sort((a, b) => b.costo - a.costo)
    }
}

export async function getMermasPeriodo(desde: Date, hasta: Date, ubicacionId?: string) {
    const registros = await obtenerRegistros(desde, hasta, ubicacionId)
    return { registros, resumen: resumir(registros) }
}

export async function getMermasCostos(desde: Date, hasta: Date, ubicacionId?: string) {
    const duracion = hasta.getTime() - desde.getTime()
    const hastaAnterior = new Date(desde.getTime() - 1)
    const desdeAnterior = new Date(hastaAnterior.getTime() - duracion)

    const [periodoActual, periodoAnterior, ubicaciones, productos, insumos] = await Promise.all([
        getMermasPeriodo(desde, hasta, ubicacionId),
        getMermasPeriodo(desdeAnterior, hastaAnterior, ubicacionId),
        prisma.ubicacion.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
        prisma.producto.findMany({
            where: { activo: true },
            select: {
                id: true,
                nombre: true,
                presentaciones: {
                    where: { activo: true },
                    select: {
                        id: true,
                        cantidad: true,
                        stocks: { select: { ubicacionId: true, cantidad: true } }
                    },
                    orderBy: { cantidad: 'desc' }
                }
            },
            orderBy: { nombre: 'asc' }
        }),
        prisma.insumo.findMany({
            where: { activo: true },
            select: {
                id: true,
                nombre: true,
                unidadMedida: true,
                stocks: { select: { ubicacionId: true, cantidad: true } }
            },
            orderBy: { nombre: 'asc' }
        })
    ])

    const { registros, resumen } = periodoActual
    const anterior = periodoAnterior.resumen
    return {
        desde,
        hasta,
        registros,
        resumen: {
            ...resumen,
            costoAnterior: anterior.costoTotal,
            variacionPct: anterior.costoTotal > 0
                ? ((resumen.costoTotal - anterior.costoTotal) / anterior.costoTotal) * 100
                : null
        },
        catalogos: { ubicaciones, productos, insumos }
    }
}
