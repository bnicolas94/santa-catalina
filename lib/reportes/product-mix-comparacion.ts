import type { calcularProductMix } from './product-mix'

type Mix = ReturnType<typeof calcularProductMix>
type Fila = Mix['filas'][number]
type Insumo = Mix['totales'][number]
const redondear = (valor: number) => Math.round(valor * 1_000_000) / 1_000_000
const dia = 86_400_000

export function diasRangoIso(desde: string, hasta: string) {
    return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / dia) + 1
}

export function rangoAnteriorIgualDuracion(desde: string, hasta: string) {
    const inicio = Date.parse(`${desde}T00:00:00Z`)
    const dias = diasRangoIso(desde, hasta)
    const fecha = (valor: number) => new Date(valor).toISOString().slice(0, 10)
    return { desde: fecha(inicio - dias * dia), hasta: fecha(inicio - dia) }
}

function compararInsumos(principal: Insumo[], referencia: Insumo[]) {
    const porIdPrincipal = new Map(principal.map(item => [item.id, item]))
    const porIdReferencia = new Map(referencia.map(item => [item.id, item]))
    return [...new Set([...porIdPrincipal.keys(), ...porIdReferencia.keys()])].map(id => {
        const a = porIdPrincipal.get(id)
        const b = porIdReferencia.get(id)
        const costoA = a ? a.costoIdentificado : 0
        const costoB = b ? b.costoIdentificado : 0
        return { id, nombre: a?.nombre ?? b!.nombre, unidad: a?.unidad ?? b!.unidad,
            principal: { cantidad: a?.cantidad ?? 0, costoIdentificado: costoA },
            referencia: { cantidad: b?.cantidad ?? 0, costoIdentificado: costoB },
            diferencia: { cantidad: redondear((a?.cantidad ?? 0) - (b?.cantidad ?? 0)),
                costoIdentificado: costoA === null || costoB === null ? null : redondear(costoA - costoB) },
        }
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

function valoresFila(fila?: Fila) {
    if (!fila) return { paquetes: 0, ingresoAtribuido: 0, costoIdentificado: 0, costoCompleto: true, faltantes: [] as string[] }
    return { paquetes: fila.paquetes, ingresoAtribuido: fila.ingresoAtribuido,
        costoIdentificado: redondear(fila.insumos.reduce((total, item) => total + (item.costoIdentificado ?? 0), 0)),
        costoCompleto: fila.faltantes.length === 0 && fila.insumos.length > 0
            && fila.insumos.every(item => item.costoIdentificado !== null),
        faltantes: fila.faltantes }
}

export function compararProductMix(principal: Mix, referencia: Mix) {
    const porClavePrincipal = new Map(principal.filas.map(fila => [fila.clave, fila]))
    const porClaveReferencia = new Map(referencia.filas.map(fila => [fila.clave, fila]))
    const filas = [...new Set([...porClavePrincipal.keys(), ...porClaveReferencia.keys()])].map(clave => {
        const a = porClavePrincipal.get(clave)
        const b = porClaveReferencia.get(clave)
        const valorA = valoresFila(a)
        const valorB = valoresFila(b)
        return { clave, nombre: a?.nombre ?? b!.nombre, presentacion: a?.presentacion ?? b!.presentacion,
            principal: valorA, referencia: valorB,
            diferencia: { paquetes: valorA.paquetes - valorB.paquetes,
                ingresoAtribuido: redondear(valorA.ingresoAtribuido - valorB.ingresoAtribuido),
                costoIdentificado: valorA.costoCompleto && valorB.costoCompleto
                    ? redondear(valorA.costoIdentificado - valorB.costoIdentificado) : null },
            insumos: compararInsumos(a?.insumos ?? [], b?.insumos ?? []),
        }
    }).sort((a, b) => b.principal.paquetes - a.principal.paquetes || b.referencia.paquetes - a.referencia.paquetes
        || a.nombre.localeCompare(b.nombre, 'es'))
    const costos = (mix: Mix) => redondear(mix.totales.reduce((total, item) => total + (item.costoIdentificado ?? 0), 0))
    const costoPrincipal = costos(principal)
    const costoReferencia = costos(referencia)
    const costoCompletoPrincipal = principal.filasIncompletas === 0
    const costoCompletoReferencia = referencia.filasIncompletas === 0
    return { principal: { paquetes: principal.paquetes, filasIncompletas: principal.filasIncompletas,
            costoIdentificado: costoPrincipal, costoCompleto: costoCompletoPrincipal },
        referencia: { paquetes: referencia.paquetes, filasIncompletas: referencia.filasIncompletas,
            costoIdentificado: costoReferencia, costoCompleto: costoCompletoReferencia },
        diferencia: { paquetes: principal.paquetes - referencia.paquetes,
            costoIdentificado: costoCompletoPrincipal && costoCompletoReferencia
                ? redondear(costoPrincipal - costoReferencia) : null },
        filas, insumos: compararInsumos(principal.totales, referencia.totales) }
}
