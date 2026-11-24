import { normalizarTexto } from '@/lib/google-sheets-caja'
import { aplicaRecetaAPresentacion, calcularCantidadInsumoPorPaquete } from '@/lib/services/produccion-insumos'
import type { ReportePedidosOnline } from './pedidos-online'

export type ProductoConReceta = {
    id: string
    nombre: string
    codigoInterno: string
    presentaciones: { id: string; cantidad: number }[]
    fichasTecnicas: {
        insumoId: string
        cantidadPorUnidad: number
        merma: number
        tipoConsumo: string
        presentacionId: string | null
        insumo: { nombre: string; unidadMedida: string; precioUnitario: number }
    }[]
}

const equivalenciasConocidas: Record<string, string> = {
    'jamon y queso': 'JQ',
    'surtido clasico': 'CLA', 'surtidos clasicos': 'CLA',
    'surtido especial': 'ESP', 'surtidos especiales': 'ESP',
}

export function calcularConsumoPedidos(reporte: ReportePedidosOnline, productos: ProductoConReceta[]) {
    const porNombre = new Map<string, ProductoConReceta[]>()
    const porCodigo = new Map<string, ProductoConReceta[]>()
    for (const producto of productos) {
        const nombre = normalizarTexto(producto.nombre)
        porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), producto])
        porCodigo.set(producto.codigoInterno, [...(porCodigo.get(producto.codigoInterno) ?? []), producto])
    }

    const insumos = new Map<string, { id: string; nombre: string; unidad: string; cantidad: number; costoEstimado: number }>()
    let costoEstimado = 0, costoAnterior = 0, ingresoConCosto = 0, costoComparable = 0
    let paquetesValorados = 0, paquetesSinCosto = 0, paquetesAnteriores = 0

    const porTipo = reporte.porTipoPaquete.map(tipo => {
        paquetesAnteriores += tipo.paquetesAnteriores
        const nombre = normalizarTexto(tipo.nombre)
        const candidatos = new Map<string, ProductoConReceta>()
        for (const producto of porNombre.get(nombre) ?? []) candidatos.set(producto.id, producto)
        for (const producto of porCodigo.get(equivalenciasConocidas[nombre] ?? '') ?? []) candidatos.set(producto.id, producto)
        const producto = candidatos.size === 1 ? [...candidatos.values()][0] : null
        // El Sheet define los sabores elegidos en Observaciones. La ficha genérica
        // de ELE no identifica los insumos variables de cada plancha.
        if (nombre === 'surtidos elegidos' || nombre === 'personalizado' || producto?.codigoInterno === 'ELE') {
            paquetesSinCosto += tipo.paquetes
            return { ...tipo, productoErp: producto?.nombre ?? null, costoPorPaquete: null, costoEstimado: null,
                margenComparable: null, motivo: 'Sin receta por sabor para las planchas elegidas' }
        }
        const presentaciones = producto?.presentaciones.filter(p => p.cantidad === tipo.presentacion) ?? []
        const presentacion = presentaciones.length === 1 ? presentaciones[0] : null
        const fichas = producto && presentacion
            ? producto.fichasTecnicas.filter(f => aplicaRecetaAPresentacion(f, presentacion.id)) : []
        const recetaValida = fichas.length > 0 && fichas.every(f =>
            Number.isFinite(f.cantidadPorUnidad) && f.cantidadPorUnidad > 0 &&
            Number.isFinite(f.insumo.precioUnitario) && f.insumo.precioUnitario > 0)

        if (!recetaValida) {
            paquetesSinCosto += tipo.paquetes
            const sinPrecio = fichas.filter(f => !Number.isFinite(f.insumo.precioUnitario) || f.insumo.precioUnitario <= 0)
                .map(f => f.insumo.nombre)
            const motivo = !producto ? 'Sin producto inequívoco en ERP'
                : !presentacion ? 'Sin presentación en ERP'
                : !fichas.length ? 'Sin ficha técnica aplicable'
                : sinPrecio.length ? `Sin precio de insumo: ${sinPrecio.join(', ')}`
                : 'Cantidad inválida en ficha técnica'
            return { ...tipo, productoErp: producto?.nombre ?? null, costoPorPaquete: null, costoEstimado: null,
                margenComparable: null, motivo }
        }

        let costoPorPaquete = 0
        for (const ficha of fichas) {
            const cantidadPorPaquete = calcularCantidadInsumoPorPaquete(ficha, tipo.presentacion)
            costoPorPaquete += cantidadPorPaquete * ficha.insumo.precioUnitario
            const acumulado = insumos.get(ficha.insumoId) ?? { id: ficha.insumoId, nombre: ficha.insumo.nombre,
                unidad: ficha.insumo.unidadMedida, cantidad: 0, costoEstimado: 0 }
            acumulado.cantidad += cantidadPorPaquete * tipo.paquetes
            acumulado.costoEstimado += cantidadPorPaquete * tipo.paquetes * ficha.insumo.precioUnitario
            insumos.set(ficha.insumoId, acumulado)
        }
        const costoTipo = costoPorPaquete * tipo.paquetes
        costoEstimado += costoTipo
        costoAnterior += costoPorPaquete * tipo.paquetesAnteriores
        costoComparable += costoPorPaquete * tipo.paquetesConPrecio
        ingresoConCosto += tipo.ingresoAtribuido
        paquetesValorados += tipo.paquetes
        return { ...tipo, productoErp: producto!.nombre, costoPorPaquete, costoEstimado: costoTipo,
            margenComparable: tipo.paquetesConPrecio ? tipo.ingresoAtribuido - costoPorPaquete * tipo.paquetesConPrecio : null,
            motivo: null }
    }).filter(tipo => tipo.paquetes > 0)

    return {
        resumen: {
            ingresoEsperado: reporte.resumen.ingresoEsperado,
            paquetesVendidos: reporte.resumen.paquetesVendidos,
            costoEstimado, ingresoConCosto, costoComparable,
            margenComparable: ingresoConCosto - costoComparable,
            ingresoSinCosto: reporte.resumen.ingresoEsperado - ingresoConCosto,
            ingresoSinPaquetes: reporte.resumen.ingresoSinAsignarPaquetes,
            paquetesValorados, paquetesSinCosto,
            paquetesAnteriores, costoAnterior,
        },
        porTipo: porTipo.sort((a, b) => b.paquetes - a.paquetes || a.clave.localeCompare(b.clave)),
        porInsumo: [...insumos.values()].sort((a, b) => b.costoEstimado - a.costoEstimado),
    }
}
