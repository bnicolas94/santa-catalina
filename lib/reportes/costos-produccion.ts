import { aplicaRecetaAPresentacion, calcularConsumosProduccion } from '@/lib/services/produccion-insumos'

export type LoteParaCostos = {
    id: string; fechaProduccion: Date; estado: string; unidadesProducidas: number; unidadesRechazadas: number;
    distribucion: unknown; movimientosProducto: { presentacionId: string }[];
    producto: { id: string; nombre: string; codigoInterno: string;
        presentaciones: { id: string; cantidad: number }[];
        fichasTecnicas: { insumoId: string; cantidadPorUnidad: number; merma: number;
            tipoConsumo: string; presentacionId: string | null;
            insumo: { nombre: string; unidadMedida: string; precioUnitario: number } }[] }
}

const redondear = (valor: number) => Math.round(valor * 1_000_000) / 1_000_000
const diaMs = 86_400_000
const fechaDia = (fecha: Date) => fecha.toISOString().slice(0, 10)

export function validarRangoCostosProduccion(desde: string, hasta: string) {
    const parsear = (valor: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Indicá fechas válidas en formato AAAA-MM-DD.')
        const fecha = new Date(`${valor}T00:00:00Z`)
        if (!Number.isFinite(fecha.getTime()) || fechaDia(fecha) !== valor) throw new Error('Indicá fechas válidas en formato AAAA-MM-DD.')
        return fecha
    }
    const inicio = parsear(desde)
    const fin = parsear(hasta)
    const dias = (fin.getTime() - inicio.getTime()) / diaMs + 1
    if (dias <= 0 || dias > 366) throw new Error('Seleccioná un período de hasta 366 días.')
    return { inicio, finExclusivo: new Date(fin.getTime() + diaMs) }
}

type InsumoTotal = { id: string; nombre: string; unidad: string; cantidad: number;
    precioUnitario: number; costoIdentificado: number; precioValido: boolean }
type ProductoTotal = { clave: string; producto: string; codigo: string; presentacion: number;
    paquetes: number; rechazados: number; buenos: number; lotes: number; costoIdentificado: number;
    costoCompleto: boolean; insumos: Map<string, InsumoTotal> }

function presentacionBase(lote: LoteParaCostos) {
    const distribucion = Array.isArray(lote.distribucion) ? lote.distribucion : []
    const primerId = (distribucion[0] as { presentacionId?: unknown } | undefined)?.presentacionId
    const porDistribucion = lote.producto.presentaciones.find(p => p.id === primerId)
    if (porDistribucion) return porDistribucion
    const idsMovimiento = [...new Set(lote.movimientosProducto.map(m => m.presentacionId))]
    if (idsMovimiento.length === 1) return lote.producto.presentaciones.find(p => p.id === idsMovimiento[0]) ?? null
    return lote.producto.presentaciones.length === 1 ? lote.producto.presentaciones[0] : null
}

export function calcularCostosProduccion(lotes: LoteParaCostos[]) {
    const productos = new Map<string, ProductoTotal>()
    const insumos = new Map<string, InsumoTotal>()
    const dias = new Map<string, { fecha: string; lotes: number; paquetes: number; rechazados: number;
        costoIdentificado: number; costoCompleto: boolean }>()
    const pendientes: Array<{ loteId: string; fecha: string; producto: string; paquetes: number; motivos: string[] }> = []
    let lotesExcluidos = 0, paquetes = 0, rechazados = 0, costoIdentificado = 0, lotesConfirmados = 0
    const sumarInsumo = (destino: Map<string, InsumoTotal>, item: InsumoTotal) => {
        const actual = destino.get(item.id) ?? { ...item, cantidad: 0, costoIdentificado: 0, precioValido: true }
        actual.cantidad = redondear(actual.cantidad + item.cantidad)
        actual.costoIdentificado = redondear(actual.costoIdentificado + item.costoIdentificado)
        actual.precioValido = actual.precioValido && item.precioValido
        destino.set(item.id, actual)
    }

    for (const lote of lotes) {
        if (lote.estado === 'en_produccion' || lote.estado === 'cancelado') { lotesExcluidos++; continue }
        lotesConfirmados++
        const fecha = fechaDia(lote.fechaProduccion)
        const producido = Number(lote.unidadesProducidas)
        const rechazado = Number(lote.unidadesRechazadas)
        const cantidadValida = Number.isSafeInteger(producido) && producido > 0
            && Number.isSafeInteger(rechazado) && rechazado >= 0 && rechazado <= producido
        const motivos = new Set<string>()
        if (!cantidadValida) motivos.add('Cantidad producida o rechazada inválida')
        const base = presentacionBase(lote)
        if (!base || !Number.isSafeInteger(base.cantidad) || base.cantidad <= 0) motivos.add('Presentación base no identificable')
        const producidosValidos = cantidadValida ? producido : 0
        const rechazadosValidos = cantidadValida ? rechazado : 0
        paquetes += producidosValidos
        rechazados += rechazadosValidos
        const dia = dias.get(fecha) ?? { fecha, lotes: 0, paquetes: 0, rechazados: 0, costoIdentificado: 0, costoCompleto: true }
        dia.lotes++
        dia.paquetes += producidosValidos
        dia.rechazados += rechazadosValidos
        dias.set(fecha, dia)
        let producto: ProductoTotal | null = null
        if (base) {
            const clave = `${lote.producto.id}:${base.id}`
            producto = productos.get(clave) ?? { clave, producto: lote.producto.nombre, codigo: lote.producto.codigoInterno,
                presentacion: base.cantidad, paquetes: 0, rechazados: 0, buenos: 0, lotes: 0,
                costoIdentificado: 0, costoCompleto: true, insumos: new Map() }
            producto.lotes++
            producto.paquetes += producidosValidos
            producto.rechazados += rechazadosValidos
            producto.buenos += producidosValidos - rechazadosValidos
            productos.set(clave, producto)
        }
        let costoLote = 0
        if (base && cantidadValida) {
            const fichas = lote.producto.fichasTecnicas.filter(ficha => aplicaRecetaAPresentacion(ficha, base.id))
            if (!fichas.length) motivos.add('Sin ficha técnica aplicable')
            for (const ficha of fichas) {
                if (!Number.isFinite(ficha.cantidadPorUnidad) || ficha.cantidadPorUnidad <= 0
                    || !Number.isFinite(ficha.merma) || ficha.merma < 0 || ficha.merma >= 100
                    || !['por_unidad', 'por_paquete'].includes(ficha.tipoConsumo)) {
                    motivos.add(`Cantidad, merma o tipo inválido: ${ficha.insumo.nombre}`)
                    continue
                }
                const cantidad = calcularConsumosProduccion([ficha], producido, base.cantidad, base.id)[0]?.cantidad ?? 0
                if (cantidad <= 0) continue
                const precioValido = Number.isFinite(ficha.insumo.precioUnitario) && ficha.insumo.precioUnitario > 0
                if (!precioValido) motivos.add(`Sin precio de insumo: ${ficha.insumo.nombre}`)
                const costo = precioValido ? cantidad * ficha.insumo.precioUnitario : 0
                costoLote += costo
                const item = { id: ficha.insumoId, nombre: ficha.insumo.nombre, unidad: ficha.insumo.unidadMedida,
                    cantidad, precioUnitario: ficha.insumo.precioUnitario, costoIdentificado: costo, precioValido }
                sumarInsumo(insumos, item)
                if (producto) sumarInsumo(producto.insumos, item)
            }
        }
        costoIdentificado += costoLote
        dia.costoIdentificado += costoLote
        if (producto) {
            producto.costoIdentificado += costoLote
            producto.costoCompleto = producto.costoCompleto && motivos.size === 0
        }
        dia.costoCompleto = dia.costoCompleto && motivos.size === 0
        if (motivos.size) pendientes.push({ loteId: lote.id, fecha, producto: lote.producto.nombre,
            paquetes: producidosValidos, motivos: [...motivos] })
    }
    const serializarInsumo = (item: InsumoTotal) => ({ ...item, cantidad: redondear(item.cantidad),
        costoIdentificado: redondear(item.costoIdentificado) })
    return { resumen: { lotes: lotesConfirmados, lotesExcluidos, paquetes, rechazados,
            buenos: paquetes - rechazados, costoIdentificado: redondear(costoIdentificado),
            costoCompleto: pendientes.length === 0, lotesPendientes: pendientes.length },
        porProducto: [...productos.values()].map(item => ({ ...item, costoIdentificado: redondear(item.costoIdentificado),
            insumos: [...item.insumos.values()].map(serializarInsumo).sort((a, b) => b.costoIdentificado - a.costoIdentificado) }))
            .sort((a, b) => b.paquetes - a.paquetes || a.producto.localeCompare(b.producto, 'es')),
        porInsumo: [...insumos.values()].map(serializarInsumo).sort((a, b) => b.costoIdentificado - a.costoIdentificado),
        porDia: [...dias.values()].map(item => ({ ...item, costoIdentificado: redondear(item.costoIdentificado) }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha)),
        pendientes: pendientes.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.loteId.localeCompare(b.loteId)) }
}
