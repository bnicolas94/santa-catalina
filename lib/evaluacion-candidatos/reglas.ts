export const MODULOS_EVALUACION = ['TIPEO', 'PLANILLA', 'CONVERSACIONES', 'DETALLE', 'ATENCION', 'DEMO'] as const
export type ModuloEvaluacion = typeof MODULOS_EVALUACION[number]

export function vigenciaDias(valor = process.env.EVALUACION_INVITACION_DIAS) {
    const dias = Number(valor ?? 7)
    return Number.isInteger(dias) && dias >= 1 && dias <= 30 ? dias : 7
}

export function estadoInvitacion(inv: { venceAt: Date; revocadaAt: Date | null; intento: { inicioAt: Date } | null }, ahora = new Date()) {
    if (inv.revocadaAt) return 'REVOCADA'
    if (inv.venceAt <= ahora) return 'VENCIDA'
    if (inv.intento) return 'UTILIZADA'
    return 'PENDIENTE'
}

export function invitacionAccesible(inv: { venceAt: Date; revocadaAt: Date | null; candidato: { archivadoAt: Date | null } }, ahora = new Date()) {
    return !inv.revocadaAt && !inv.candidato.archivadoAt && inv.venceAt > ahora
}

export function validarCandidato(valor: unknown) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Datos inválidos')
    const input = valor as Record<string, unknown>
    const texto = (clave: string, max: number, obligatorio = false) => {
        if (input[clave] !== undefined && input[clave] !== null && typeof input[clave] !== 'string') throw new Error(`${clave}: valor inválido`)
        const dato = String(input[clave] ?? '').trim()
        if (dato.length > max || (obligatorio && !dato)) throw new Error(`${clave}: longitud inválida`)
        return dato || null
    }
    const nombre = texto('nombre', 80, true)!
    const apellido = texto('apellido', 80, true)!
    const telefono = texto('telefono', 40)
    const email = texto('email', 254)
    const observaciones = texto('observaciones', 4000)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo electrónico inválido')
    return { nombre, apellido, telefono, email, observaciones }
}

export function validarDemo(valor: unknown) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Respuesta inválida')
    const texto = (valor as Record<string, unknown>).texto
    if (typeof texto !== 'string' || texto.length > 2000) throw new Error('La respuesta debe tener hasta 2000 caracteres')
    return { texto }
}
