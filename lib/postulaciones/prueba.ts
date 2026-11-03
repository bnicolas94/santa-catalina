export const DURACION_MINUTOS = 45
export const VIGENCIA_DIAS = 7

export const TEXTO_TIPEO = 'Hola, soy Mariana López. Quisiera confirmar 2 paquetes Clásico x8 para mañana, en Calle 12 Nº 345, entre las 10:00 y las 12:00. Si no llegan en ese horario, avísenme antes de cerrar el pedido. Mi teléfono es 221 555 0184. Muchas gracias.'

export const CASOS_WHATSAPP = [
    { titulo: 'Consulta 1', mensaje: 'Hola, quiero 2 Clásico x8 para mañana a la mañana. ¿Me confirmás si llegan antes de las 11? Estoy en Centro, pero todavía no tengo la dirección exacta.' },
    { titulo: 'Consulta 2', mensaje: 'Ayer pedí 1 Especial x12 para retirar. Ahora quiero que me lo manden a casa. ¿Ya quedó cambiado? Mi dirección es Calle 8 Nº 210.' },
    { titulo: 'Consulta 3', mensaje: 'El pedido que recibí tiene una presentación distinta de la que pedí. Lo necesito para una reunión hoy. ¿Qué pueden hacer?' },
] as const

export const PEDIDOS = [
    { id: 'A', chat: 'Lucía: 2 Clásico x8. Mañana, entrega de 10 a 12. Calle 5 Nº 140, Centro. Tel. 221 555 0101.' },
    { id: 'B', chat: 'Tomás: 1 Especial x12, hoy de 14 a 16. Calle 30 Nº 700, Norte. Tel. 221 555 0102.' },
    { id: 'C', chat: 'Eva: 3 Veggie x8 para mañana a la mañana. Zona Sur. Tel. 221 555 0103. No indicó calle ni número.' },
    { id: 'D', chat: 'Bruno: 1 Clásico x8 para hoy de 10 a 12. Calle 7 Nº 290, Centro. Tel. 221 555 0104. En un segundo mensaje pidió 2 paquetes en total.' },
] as const

export const CAMPOS_PEDIDO = ['cliente', 'producto', 'cantidad', 'fecha', 'horario', 'direccion', 'estado'] as const
export type CampoPedido = typeof CAMPOS_PEDIDO[number]
export type FilaPedido = Record<CampoPedido, string>
export type Respuestas = { tipeo: string; whatsapp: string[]; pedidos: FilaPedido[]; rutas: string; criterio: string }

export function vencePrueba(inicio: Date) { return new Date(inicio.getTime() + DURACION_MINUTOS * 60_000) }

export function validarRespuestas(value: unknown): Respuestas {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuestas inválidas')
    const input = value as Record<string, unknown>
    function texto(v: unknown, max: number): string {
        if (typeof v !== 'string' || v.length > max) throw new Error('Una respuesta es inválida o demasiado larga')
        return v.trim()
    }
    if (!Array.isArray(input.whatsapp) || input.whatsapp.length !== CASOS_WHATSAPP.length) throw new Error('Faltan respuestas de atención')
    if (!Array.isArray(input.pedidos) || input.pedidos.length !== PEDIDOS.length) throw new Error('Faltan pedidos')
    const respuestas: Respuestas = {
        tipeo: texto(input.tipeo, 1000),
        whatsapp: input.whatsapp.map(v => texto(v, 2000)),
        pedidos: input.pedidos.map(row => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Pedido inválido')
            return Object.fromEntries(CAMPOS_PEDIDO.map(campo => [campo, texto((row as Record<string, unknown>)[campo], 300)])) as FilaPedido
        }),
        rutas: texto(input.rutas, 3000),
        criterio: texto(input.criterio, 3000),
    }
    if (!respuestas.tipeo || respuestas.whatsapp.some(v => !v) || respuestas.pedidos.some(row => !row.cliente) || !respuestas.rutas || !respuestas.criterio) {
        throw new Error('Completá todas las secciones antes de entregar')
    }
    return respuestas
}

export function validarRevision(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Revisión inválida')
    const input = value as Record<string, unknown>
    const criterios = ['tipeo', 'atencion', 'pedidos', 'rutas', 'criterio'] as const
    const puntajes = Object.fromEntries(criterios.map(campo => {
        const numero = input[campo]
        if (!Number.isInteger(numero) || (numero as number) < 0 || (numero as number) > 5) throw new Error('Los puntajes deben estar entre 0 y 5')
        return [campo, numero]
    })) as Record<typeof criterios[number], number>
    if (typeof input.observaciones !== 'string' || input.observaciones.length > 4000) throw new Error('Observaciones inválidas')
    return { ...puntajes, observaciones: input.observaciones.trim() }
}
