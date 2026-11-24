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
    recetasElegidos?: {
        alcance: string; cantidad: number; merma: number; insumoId: string;
        variante: { codigo: string } | null; presentacion: { cantidad: number } | null;
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
        if (nombre === 'surtidos elegidos' || nombre === 'personalizado' || nombre === 'elegidos' || producto?.codigoInterno === 'ELE') {
            paquetesSinCosto += tipo.paquetes
            return { ...tipo, productoErp: producto?.nombre ?? null, costoPorPaquete: null, costoEstimado: null,
                margenComparable: null, motivo: 'Costo según mezcla de sabores en el resumen' }
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

    const elegidos = productos.filter(producto => producto.codigoInterno === 'ELE')
    const recetaElegidos = elegidos.length === 1 ? elegidos[0].recetasElegidos ?? [] : []
    let elegidosValorados = 0, elegidosSinCosto = 0, costoElegidos = 0, ingresoElegidos = 0
    const faltantesElegidos = new Map<string, number>()
    const registrarFalta = (motivo: string, paquetes: number) => faltantesElegidos.set(motivo, (faltantesElegidos.get(motivo) ?? 0) + paquetes)
    for (const pedido of reporte.pedidosElegidos) {
        const paquetes = pedido.presentaciones.reduce((total, p) => total + p.paquetes, 0)
        if (!pedido.sabores) {
            if (pedido.periodo === 'actual') { elegidosSinCosto += paquetes; registrarFalta('Sin sabores válidos en el Sheet', paquetes) }
            continue
        }
        const base = recetaElegidos.filter(r => r.alcance === 'base')
        const sabor = (codigo: string) => recetaElegidos.filter(r => r.alcance === 'sabor' && r.variante?.codigo === codigo)
        const empaque = (cantidad: number) => recetaElegidos.filter(r => r.alcance === 'empaque' && r.presentacion?.cantidad === cantidad)
        const motivo = !base.length ? 'Falta receta de base común'
            : pedido.sabores.find(s => !sabor(s.codigo).length) ? `Falta receta de sabor ${pedido.sabores.find(s => !sabor(s.codigo).length)!.nombre}`
            : pedido.presentaciones.find(p => !empaque(p.cantidad).length) ? `Falta receta de empaque x${pedido.presentaciones.find(p => !empaque(p.cantidad).length)!.cantidad}`
            : null
        if (motivo) {
            if (pedido.periodo === 'actual') { elegidosSinCosto += paquetes; registrarFalta(motivo, paquetes) }
            continue
        }
        const cantidades = new Map<string, { receta: typeof recetaElegidos[number]; cantidad: number }>()
        const agregar = (receta: typeof recetaElegidos[number], veces: number) => {
            const cantidad = receta.cantidad / (1 - Math.min(Math.max(receta.merma, 0), 99.99) / 100) * veces
            const previo = cantidades.get(receta.insumoId)
            cantidades.set(receta.insumoId, { receta, cantidad: (previo?.cantidad ?? 0) + cantidad })
        }
        const sandwiches = pedido.sabores.reduce((total, s) => total + s.sandwiches, 0)
        for (const receta of base) agregar(receta, sandwiches)
        for (const s of pedido.sabores) for (const receta of sabor(s.codigo)) agregar(receta, s.sandwiches / 8)
        for (const p of pedido.presentaciones) for (const receta of empaque(p.cantidad)) agregar(receta, p.paquetes)
        const sinPrecio = [...cantidades.values()].find(x => !Number.isFinite(x.receta.cantidad) || x.receta.cantidad <= 0 ||
            !Number.isFinite(x.receta.insumo.precioUnitario) || x.receta.insumo.precioUnitario <= 0)
        if (sinPrecio) {
            if (pedido.periodo === 'actual') { elegidosSinCosto += paquetes; registrarFalta(`Falta cantidad o precio de ${sinPrecio.receta.insumo.nombre}`, paquetes) }
            continue
        }
        const costoPedido = [...cantidades.values()].reduce((total, x) => total + x.cantidad * x.receta.insumo.precioUnitario, 0)
        if (pedido.periodo === 'anterior') { costoAnterior += costoPedido; continue }
        elegidosValorados += paquetes
        costoElegidos += costoPedido
        ingresoElegidos += pedido.ingresoAtribuido
        costoEstimado += costoPedido
        if (pedido.precioValido) { ingresoConCosto += pedido.ingresoAtribuido; costoComparable += costoPedido }
        paquetesValorados += paquetes
        paquetesSinCosto -= paquetes
        for (const x of cantidades.values()) {
            const actual = insumos.get(x.receta.insumoId) ?? { id: x.receta.insumoId, nombre: x.receta.insumo.nombre,
                unidad: x.receta.insumo.unidadMedida, cantidad: 0, costoEstimado: 0 }
            actual.cantidad += x.cantidad
            actual.costoEstimado += x.cantidad * x.receta.insumo.precioUnitario
            insumos.set(x.receta.insumoId, actual)
        }
    }

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
            elegidos: { paquetesValorados: elegidosValorados, paquetesSinCosto: elegidosSinCosto,
                costoEstimado: costoElegidos, ingresoAtribuido: ingresoElegidos,
                faltantes: [...faltantesElegidos].map(([motivo, paquetes]) => ({ motivo, paquetes })) },
        },
        porTipo: porTipo.sort((a, b) => b.paquetes - a.paquetes || a.clave.localeCompare(b.clave)),
        porInsumo: [...insumos.values()].sort((a, b) => b.costoEstimado - a.costoEstimado),
    }
}
