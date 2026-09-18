import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CajaValidationError, tieneAccesoCaja, validarCambioCaja, validarDatosCaja, type UsuarioCajas } from '@/lib/caja/catalogo'

export async function listarCajas(usuario: UsuarioCajas, incluirInactivas = false) {
    const cajas = await prisma.saldoCaja.findMany({ include: { ubicacion: true }, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }, { tipo: 'asc' }] })
    return cajas.filter(c => (incluirInactivas || (c.activo && (!c.ubicacion || c.ubicacion.activo))) && tieneAccesoCaja(usuario, c, false))
}

export async function exigirAccesoCaja(usuario: UsuarioCajas, tipo: unknown, escritura = true) {
    if (typeof tipo !== 'string' || !tipo) throw new CajaValidationError('Seleccioná una caja.')
    const caja = await prisma.saldoCaja.findUnique({ where: { tipo }, include: { ubicacion: true } })
    if (!caja || !tieneAccesoCaja(usuario, caja, escritura)) throw new CajaValidationError('No podés operar en esta caja: verificá la sede y que esté activa.')
    return caja
}

export async function guardarCaja(input: unknown, usuarioId: string, id?: string) {
    const data = validarDatosCaja(input)
    if (!id && !data.ubicacionId) throw new CajaValidationError('Las cajas nuevas deben vincularse a una sede.')
    return prisma.$transaction(async tx => {
        const actual = id ? await tx.saldoCaja.findUniqueOrThrow({ where: { id } }) : null
        if (data.ubicacionId) {
            const sede = await tx.ubicacion.findUnique({ where: { id: data.ubicacionId } })
            if (!sede || (!sede.activo && (data.activo || actual?.ubicacionId !== data.ubicacionId))) throw new CajaValidationError('Seleccioná una sede activa.')
        }
        if (actual) {
            const historial = await tx.movimientoCaja.count({ where: { cajaOrigen: actual.tipo } })
            const pendientes = await tx.depositoCaja.count({
                where: {
                    estado: 'pendiente',
                    OR: [{ cajaOrigen: actual.tipo }, { cajaRecepcion: actual.tipo }, { cajaDestino: actual.tipo }],
                },
            })
            validarCambioCaja(actual, data, historial > 0, pendientes > 0)
        }
        const caja = actual ? await tx.saldoCaja.update({ where: { id }, data }) :
            await tx.saldoCaja.create({ data: { ...data, tipo: `caja_${randomUUID()}`, saldo: 0 } })
        await tx.auditoriaConfiguracionCaja.create({ data: {
            cajaId: caja.id, usuarioId, accion: actual ? 'MODIFICACION' : 'CREACION',
            anteriores: actual ? { nombre: actual.nombre, activo: actual.activo, ubicacionId: actual.ubicacionId, recibeDepositos: actual.recibeDepositos, conceptoDeposito: actual.conceptoDeposito } : Prisma.JsonNull,
            nuevos: data,
        } })
        return caja
    }, { isolationLevel: 'Serializable' })
}
