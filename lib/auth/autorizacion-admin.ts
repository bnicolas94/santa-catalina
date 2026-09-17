import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'

export class CredencialesAdministradorInvalidasError extends Error {
    constructor() {
        super('Las credenciales del administrador no son válidas.')
        this.name = 'CredencialesAdministradorInvalidasError'
    }
}

export async function validarCredencialesAdministrador(input: unknown) {
    const datos = input && typeof input === 'object' ? input as Record<string, unknown> : {}
    const usuario = typeof datos.usuario === 'string' ? datos.usuario.trim() : ''
    const password = typeof datos.password === 'string' ? datos.password : ''
    if (!usuario || !password) throw new CredencialesAdministradorInvalidasError()

    const empleado = await prisma.empleado.findFirst({
        where: { email: { equals: usuario, mode: 'insensitive' } },
        select: { id: true, nombre: true, apellido: true, activo: true, password: true, rol: true, rolRel: { select: { nombre: true } } },
    })
    const rolEfectivo = empleado?.rolRel?.nombre || empleado?.rol
    const passwordValido = empleado?.password ? await bcrypt.compare(password, empleado.password) : false
    if (!empleado?.activo || rolEfectivo !== 'ADMIN' || !passwordValido) {
        throw new CredencialesAdministradorInvalidasError()
    }

    return { id: empleado.id, nombre: empleado.nombre, apellido: empleado.apellido }
}
