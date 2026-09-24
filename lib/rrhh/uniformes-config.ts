import { prisma } from '@/lib/prisma'
import { ErrorUniformes, validarCuitUniformes } from './uniformes'

const CLAVE_EMPLEADOR = 'uniformes:299:empleador'
const CLAVE_EPP_GENERAL = 'uniformes:299:epp:general'
const claveEstablecimiento = (id: string) => `uniformes:299:establecimiento:${id}`
const claveEppPuesto = (id: string) => `uniformes:299:epp:puesto:${id}`

export type EmpleadorUniformes = { razonSocial: string; cuit: string }
export type EstablecimientoUniformes = { direccion: string; localidad: string; codigoPostal: string; provincia: string }

function texto(valor: unknown, etiqueta: string, maximo = 150) {
    if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) {
        throw new ErrorUniformes(`${etiqueta} debe tener entre 1 y ${maximo} caracteres.`)
    }
    return valor.trim()
}

function leerJson<T>(valor: string | undefined): T | null {
    if (!valor) return null
    try { return JSON.parse(valor) as T } catch { return null }
}

export async function consultarConfiguracionUniformes() {
    const [registros, ubicaciones, puestos] = await Promise.all([
        prisma.configuracionGlobal.findMany({ where: { clave: { startsWith: 'uniformes:299:' } }, select: { clave: true, valor: true } }),
        prisma.ubicacion.findMany({ select: { id: true, nombre: true, activo: true }, orderBy: { nombre: 'asc' } }),
        prisma.puesto.findMany({ select: { id: true, nombre: true, activo: true }, orderBy: { nombre: 'asc' } }),
    ])
    const valores = new Map(registros.map(item => [item.clave, item.valor]))
    return {
        empleador: leerJson<EmpleadorUniformes>(valores.get(CLAVE_EMPLEADOR)),
        eppGeneral: valores.get(CLAVE_EPP_GENERAL) || '',
        establecimientos: ubicaciones.map(ubicacion => ({
            ...ubicacion,
            datos: leerJson<EstablecimientoUniformes>(valores.get(claveEstablecimiento(ubicacion.id))),
        })),
        puestos: puestos.map(puesto => ({ ...puesto, eppNecesarios: valores.get(claveEppPuesto(puesto.id)) || '' })),
    }
}

export async function guardarConfiguracionUniformes(entrada: unknown) {
    if (!entrada || typeof entrada !== 'object') throw new ErrorUniformes('Datos inválidos.')
    const dato = entrada as Record<string, unknown>
    let clave: string
    let valor: string
    if (dato.tipo === 'empleador') {
        const razonSocial = texto(dato.razonSocial, 'La razón social')
        const cuit = validarCuitUniformes(dato.cuit)
        clave = CLAVE_EMPLEADOR
        valor = JSON.stringify({ razonSocial, cuit } satisfies EmpleadorUniformes)
    } else if (dato.tipo === 'establecimiento') {
        const id = texto(dato.ubicacionId, 'La sede', 100)
        const existe = await prisma.ubicacion.findUnique({ where: { id }, select: { id: true } })
        if (!existe) throw new ErrorUniformes('Sede no encontrada.', 404)
        clave = claveEstablecimiento(id)
        valor = JSON.stringify({
            direccion: texto(dato.direccion, 'La dirección'),
            localidad: texto(dato.localidad, 'La localidad'),
            codigoPostal: texto(dato.codigoPostal, 'El código postal', 20),
            provincia: texto(dato.provincia, 'La provincia'),
        } satisfies EstablecimientoUniformes)
    } else if (dato.tipo === 'epp') {
        const puestoId = dato.puestoId
        if (puestoId != null && puestoId !== '') {
            const id = texto(puestoId, 'El puesto', 100)
            const existe = await prisma.puesto.findUnique({ where: { id }, select: { id: true } })
            if (!existe) throw new ErrorUniformes('Puesto no encontrado.', 404)
            clave = claveEppPuesto(id)
        } else {
            clave = CLAVE_EPP_GENERAL
        }
        valor = texto(dato.eppNecesarios, 'Los EPP requeridos', 1000)
    } else {
        throw new ErrorUniformes('Tipo de configuración inválido.')
    }
    await prisma.configuracionGlobal.upsert({
        where: { clave }, create: { clave, valor }, update: { valor },
    })
    return { clave }
}

export async function consultarDatosConstancia(ubicacionId: string | null, puestoId: string | null) {
    const claves = [CLAVE_EMPLEADOR, CLAVE_EPP_GENERAL]
    if (ubicacionId) claves.push(claveEstablecimiento(ubicacionId))
    if (puestoId) claves.push(claveEppPuesto(puestoId))
    const registros = await prisma.configuracionGlobal.findMany({ where: { clave: { in: claves } }, select: { clave: true, valor: true } })
    const valores = new Map(registros.map(item => [item.clave, item.valor]))
    return {
        empleador: leerJson<EmpleadorUniformes>(valores.get(CLAVE_EMPLEADOR)),
        establecimiento: ubicacionId ? leerJson<EstablecimientoUniformes>(valores.get(claveEstablecimiento(ubicacionId))) : null,
        eppNecesarios: (puestoId ? valores.get(claveEppPuesto(puestoId)) : null) || valores.get(CLAVE_EPP_GENERAL) || '',
    }
}
