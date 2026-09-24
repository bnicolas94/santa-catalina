import { PrendaUniforme } from '@prisma/client'
import { validarFechaCivilRRHH } from './fechas'

export class ErrorUniformes extends Error {
    constructor(message: string, public readonly status = 400) {
        super(message)
    }
}

export type DetalleUniforme = { prenda: PrendaUniforme; talle: string; cantidad: number }

export function validarPrenda(valor: unknown): PrendaUniforme {
    if (valor === PrendaUniforme.REMERA || valor === PrendaUniforme.BUZO) return valor
    throw new ErrorUniformes('La prenda debe ser Remera o Buzo.')
}

export function validarTalle(valor: unknown): string {
    if (typeof valor !== 'string') throw new ErrorUniformes('Ingresá un talle.')
    const talle = valor.trim().toUpperCase()
    if (!talle || talle.length > 20) throw new ErrorUniformes('El talle debe tener entre 1 y 20 caracteres.')
    return talle
}

export function validarCantidadEntera(valor: unknown, maximo = 10_000): number {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0 || valor > maximo) {
        throw new ErrorUniformes(`La cantidad debe ser un entero entre 1 y ${maximo}.`)
    }
    return valor
}

export function validarDetallesUniforme(valor: unknown): DetalleUniforme[] {
    if (!Array.isArray(valor) || valor.length === 0 || valor.length > 20) {
        throw new ErrorUniformes('Ingresá entre 1 y 20 prendas para la entrega.')
    }
    const detalles = valor.map((item: unknown) => {
        if (!item || typeof item !== 'object') throw new ErrorUniformes('Detalle de prenda inválido.')
        const dato = item as Record<string, unknown>
        return {
            prenda: validarPrenda(dato.prenda),
            talle: validarTalle(dato.talle),
            cantidad: validarCantidadEntera(dato.cantidad),
        }
    })
    const claves = detalles.map(item => `${item.prenda}:${item.talle}`)
    if (new Set(claves).size !== claves.length) throw new ErrorUniformes('Hay prendas y talles repetidos.')
    return detalles
}

export function validarFechaEntrega(valor: unknown): string {
    if (typeof valor !== 'string' || valor.length !== 10) throw new ErrorUniformes('Fecha de entrega inválida.')
    try {
        return validarFechaCivilRRHH(valor)
    } catch {
        throw new ErrorUniformes('Fecha de entrega inválida.')
    }
}

export function validarTextoOpcional(valor: unknown, maximo: number): string | null {
    if (valor == null || valor === '') return null
    if (typeof valor !== 'string') throw new ErrorUniformes('Texto inválido.')
    const texto = valor.trim()
    if (texto.length > maximo) throw new ErrorUniformes(`El texto no puede superar ${maximo} caracteres.`)
    return texto || null
}

export function validarCuitUniformes(valor: unknown): string {
    const cuit = typeof valor === 'string' ? valor.replace(/\D/g, '') : ''
    if (!/^\d{11}$/.test(cuit)) throw new ErrorUniformes('El CUIT debe tener 11 dígitos.')
    return cuit
}

export function faltantesConstanciaUniformes(datos: {
    empleador: { razonSocial: string; cuit: string } | null
    establecimiento: { direccion: string; localidad: string; codigoPostal: string; provincia: string } | null
    dni: string | null
    puesto: string | null
    eppNecesarios: string
    filas: { tipoModelo: string | null; marca: string | null; certificado: boolean | null }[]
}): string[] {
    const faltantes: string[] = []
    if (!datos.empleador?.razonSocial || !datos.empleador.cuit) faltantes.push('Razón social y CUIT del empleador')
    if (!datos.establecimiento || Object.values(datos.establecimiento).some(valor => !valor)) {
        faltantes.push('Domicilio, localidad, CP y provincia de la sede del trabajador')
    }
    if (!datos.dni) faltantes.push('DNI del trabajador')
    if (!datos.puesto) faltantes.push('Puesto de trabajo asignado al empleado')
    if (!datos.eppNecesarios) faltantes.push('EPP requeridos para el puesto de trabajo')
    if (datos.filas.length === 0) faltantes.push('Al menos una entrega nueva con detalle de prendas')
    if (datos.filas.some(fila => !fila.tipoModelo || !fila.marca || fila.certificado === null)) {
        faltantes.push('Modelo, marca y certificación de todas las prendas entregadas')
    }
    return faltantes
}
