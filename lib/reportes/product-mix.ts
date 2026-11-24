import { normalizarTexto } from '@/lib/google-sheets-caja'
import { aplicaRecetaAPresentacion, calcularCantidadInsumoPorPaquete } from '@/lib/services/produccion-insumos'
import type { ProductoConReceta } from './consumo-pedidos'
import type { ReportePedidosOnline } from './pedidos-online'

type InsumoMix = { id: string; nombre: string; unidad: string; cantidad: number; costoIdentificado: number | null }
type FilaMix = { clave: string; nombre: string; presentacion: number | null; paquetes: number;
    ingresoAtribuido: number; insumos: InsumoMix[]; faltantes: string[] }
type FilaInterna = Omit<FilaMix, 'insumos' | 'faltantes'> & { insumos: Map<string, InsumoMix>; faltantes: Set<string> }

const equivalencias: Record<string, string> = {
    'jamon y queso': 'JQ', 'surtido clasico': 'CLA', 'surtidos clasicos': 'CLA',
    'surtido especial': 'ESP', 'surtidos especiales': 'ESP',
}
const personalizados = new Set(['surtidos elegidos', 'elegidos', 'personalizado'])
const cantidadValida = (cantidad: number) => Number.isFinite(cantidad) && cantidad > 0
const precioValido = (precio: number) => Number.isFinite(precio) && precio > 0
const redondear = (valor: number) => Math.round(valor * 1_000_000) / 1_000_000

export function calcularProductMix(reporte: ReportePedidosOnline, productos: ProductoConReceta[]) {
    const filas = new Map<string, FilaInterna>()
    const porNombre = new Map<string, ProductoConReceta[]>()
    const porCodigo = new Map<string, ProductoConReceta[]>()
    for (const producto of productos) {
        const nombre = normalizarTexto(producto.nombre)
        porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), producto])
        porCodigo.set(producto.codigoInterno, [...(porCodigo.get(producto.codigoInterno) ?? []), producto])
    }
    const crearFila = (clave: string, nombre: string, presentacion: number | null) => {
        const fila = filas.get(clave) ?? { clave, nombre, presentacion, paquetes: 0,
            ingresoAtribuido: 0, insumos: new Map<string, InsumoMix>(), faltantes: new Set<string>() }
        filas.set(clave, fila)
        return fila
    }
    const agregarInsumo = (fila: FilaInterna, insumoId: string,
        insumo: { nombre: string; unidadMedida: string; precioUnitario: number }, cantidad: number) => {
        if (!cantidadValida(cantidad)) { fila.faltantes.add(`Cantidad inválida: ${insumo.nombre}`); return }
        const anterior = fila.insumos.get(insumoId)
        const costo = precioValido(insumo.precioUnitario) ? cantidad * insumo.precioUnitario : null
        fila.insumos.set(insumoId, { id: insumoId, nombre: insumo.nombre, unidad: insumo.unidadMedida,
            cantidad: (anterior?.cantidad ?? 0) + cantidad,
            costoIdentificado: costo === null || anterior?.costoIdentificado === null
                ? null : (anterior?.costoIdentificado ?? 0) + costo })
        if (costo === null) fila.faltantes.add(`Sin precio: ${insumo.nombre}`)
    }

    for (const tipo of reporte.porTipoPaquete.filter(tipo => tipo.paquetes > 0)) {
        const nombre = normalizarTexto(tipo.nombre)
        if (personalizados.has(nombre)) continue
        const fila = crearFila(tipo.clave, tipo.nombre, tipo.presentacion)
        fila.paquetes += tipo.paquetes
        fila.ingresoAtribuido += tipo.ingresoAtribuido
        const candidatos = new Map<string, ProductoConReceta>()
        for (const producto of porNombre.get(nombre) ?? []) candidatos.set(producto.id, producto)
        for (const producto of porCodigo.get(equivalencias[nombre] ?? '') ?? []) candidatos.set(producto.id, producto)
        const producto = candidatos.size === 1 ? [...candidatos.values()][0] : null
        if (!producto) { fila.faltantes.add('Sin producto inequívoco en ERP'); continue }
        const presentaciones = producto.presentaciones.filter(p => p.cantidad === tipo.presentacion)
        if (presentaciones.length !== 1) { fila.faltantes.add('Sin presentación inequívoca en ERP'); continue }
        const fichas = producto.fichasTecnicas.filter(f => aplicaRecetaAPresentacion(f, presentaciones[0].id))
        if (!fichas.length) { fila.faltantes.add('Sin ficha técnica aplicable'); continue }
        for (const ficha of fichas) {
            if (!cantidadValida(ficha.cantidadPorUnidad) || !Number.isFinite(ficha.merma) || ficha.merma < 0 || ficha.merma >= 100) {
                fila.faltantes.add(`Cantidad o merma inválida: ${ficha.insumo.nombre}`)
                continue
            }
            agregarInsumo(fila, ficha.insumoId, ficha.insumo,
                calcularCantidadInsumoPorPaquete(ficha, tipo.presentacion) * tipo.paquetes)
        }
    }

    const elegidos = productos.filter(p => p.codigoInterno === 'ELE')
    const recetas = elegidos.length === 1 ? elegidos[0].recetasElegidos ?? [] : []
    const sabores = (codigo: string) => recetas.filter(r => r.alcance === 'sabor' && r.variante?.codigo === codigo)
    const empaques = (cantidad: number) => recetas.filter(r => r.alcance === 'empaque' && r.presentacion?.cantidad === cantidad)
    const tipos = new Map(reporte.porTipoPaquete.map(tipo => [tipo.clave, tipo]))
    for (const pedido of reporte.pedidosElegidos.filter(p => p.periodo === 'actual')) {
        const claves = [...new Set(pedido.presentaciones.map(p => p.clave))]
        const tipo = claves.length === 1 ? tipos.get(claves[0]) : null
        const fila = tipo ? crearFila(tipo.clave, tipo.nombre, tipo.presentacion)
            : crearFila('personalizados:mixtos', 'Personalizados mixtos', null)
        fila.paquetes += pedido.presentaciones.reduce((total, p) => total + p.paquetes, 0)
        fila.ingresoAtribuido += pedido.ingresoAtribuido
        if (!pedido.sabores) fila.faltantes.add('Sin sabores válidos en el Sheet')
        for (const elegido of pedido.sabores ?? []) {
            const fichas = sabores(elegido.codigo)
            if (!fichas.length) fila.faltantes.add(`Falta ficha de ${elegido.nombre}`)
            for (const ficha of fichas) {
                if (!cantidadValida(ficha.cantidad) || !Number.isFinite(ficha.merma) || ficha.merma < 0 || ficha.merma >= 100) {
                    fila.faltantes.add(`Cantidad o merma inválida: ${ficha.insumo.nombre}`)
                    continue
                }
                agregarInsumo(fila, ficha.insumoId, ficha.insumo,
                    ficha.cantidad / (1 - ficha.merma / 100) * elegido.sandwiches / 8)
            }
        }
        for (const presentacion of pedido.presentaciones) {
            const fichas = empaques(presentacion.cantidad)
            if (!fichas.length) fila.faltantes.add(`Falta empaque x${presentacion.cantidad}`)
            for (const ficha of fichas) {
                if (!cantidadValida(ficha.cantidad) || !Number.isFinite(ficha.merma) || ficha.merma < 0 || ficha.merma >= 100) {
                    fila.faltantes.add(`Cantidad o merma inválida: ${ficha.insumo.nombre}`)
                    continue
                }
                agregarInsumo(fila, ficha.insumoId, ficha.insumo,
                    ficha.cantidad / (1 - ficha.merma / 100) * presentacion.paquetes)
            }
        }
    }

    const totales = new Map<string, InsumoMix>()
    const serializar = (fila: FilaInterna): FilaMix => ({ ...fila,
        insumos: [...fila.insumos.values()].map(item => ({ ...item, cantidad: redondear(item.cantidad),
            costoIdentificado: item.costoIdentificado === null ? null : redondear(item.costoIdentificado) }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        faltantes: [...fila.faltantes] })
    const resultado = [...filas.values()].map(serializar)
        .sort((a, b) => b.paquetes - a.paquetes || a.nombre.localeCompare(b.nombre, 'es') || (a.presentacion ?? 0) - (b.presentacion ?? 0))
    for (const fila of resultado) for (const item of fila.insumos) {
        const anterior = totales.get(item.id)
        totales.set(item.id, { ...item, cantidad: redondear((anterior?.cantidad ?? 0) + item.cantidad),
            costoIdentificado: item.costoIdentificado === null || anterior?.costoIdentificado === null
                ? null : redondear((anterior?.costoIdentificado ?? 0) + item.costoIdentificado) })
    }
    return { filas: resultado, totales: [...totales.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        paquetes: resultado.reduce((total, fila) => total + fila.paquetes, 0),
        filasIncompletas: resultado.filter(fila => fila.faltantes.length > 0).length }
}
