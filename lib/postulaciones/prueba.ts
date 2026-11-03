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

export const PRUEBA_GENERAL = {
    titulo: 'Prueba administrativa general',
    introduccion: 'Vas a transcribir un texto, responder consultas, ordenar datos y explicar cómo organizarías entregas. Toda la información necesaria está en esta página. No necesitás conocer Santa Catalina ni sus sistemas.',
    referencia: 'Para esta simulación, “hoy” es lunes 9 de noviembre de 2026 y “mañana” es martes 10 de noviembre de 2026.',
    textoTipeo: 'El lunes 9 de noviembre, Laura Gómez solicitó 3 cajas de carpetas para Calle 18 Nº 240. Prefiere recibirlas entre las 10:00 y las 12:00. Su teléfono es 221 555 0148. Antes de confirmar, hay que verificar que la dirección esté completa y que el horario esté disponible.',
    reglaAtencion: 'Regla del ejercicio: no confirmes horarios o cambios que no puedas verificar. Pedí los datos que falten. Ante un reclamo, explicá el siguiente paso sin prometer un resultado que todavía no conocés.',
    casosWhatsapp: [
        { titulo: 'Consulta 1', mensaje: 'Hola, necesito recibir un pedido mañana antes de las 11. ¿Podés confirmarlo? Estoy en la zona Centro, pero todavía no sé la dirección exacta.' },
        { titulo: 'Consulta 2', mensaje: 'Necesito cambiar la dirección de una entrega que ya está programada. ¿Me confirmás que quedó cambiada? La nueva es Calle 8 Nº 210.' },
        { titulo: 'Consulta 3', mensaje: 'Recibí algo distinto de lo que solicité y lo necesito hoy. ¿Qué puedo hacer?' },
    ],
    pedidos: [
        { id: 'A', chat: 'Lucía: 2 cajas de cuadernos. Mañana, entrega de 10 a 12. Calle 5 Nº 140, Centro. Tel. 221 555 0101.' },
        { id: 'B', chat: 'Tomás: 1 caja de carpetas, hoy de 14 a 16. Calle 30 Nº 700, Norte. Tel. 221 555 0102.' },
        { id: 'C', chat: 'Eva: 3 cajas de lápices para mañana de 10 a 12. Zona Sur. Tel. 221 555 0103. No indicó calle ni número.' },
        { id: 'D', chat: 'Bruno: 1 caja de cuadernos para hoy de 10 a 12. Calle 7 Nº 290, Centro. Tel. 221 555 0104. En un segundo mensaje pidió 2 cajas en total.' },
    ],
    reglaPedidos: 'Usá una fila por solicitud. Copiá sólo lo que figura en los mensajes; si falta un dato, escribí “pendiente”. En Estado / observación, señalá lo que habría que verificar antes de confirmar.',
    reglaRutas: 'No hace falta conocer las calles ni calcular kilómetros. Agrupá por zona, horario y capacidad. Si faltan datos para prometer una hora exacta, indicalo.',
    criterio: 'Mientras registrás solicitudes, Eva pide una entrega urgente pero todavía no informó la dirección. A la vez, Bruno cambia la cantidad cuando el reparto de hoy ya está organizado. ¿Qué hacés primero, qué verificás y a quién avisás?',
    guiaRevision: 'En atención: pedir datos y no confirmar cambios u horarios sin verificar. En registro: Eva queda pendiente por dirección y Bruno pide 2 cajas. En entregas: respetar zonas, horarios y capacidad; reconocer que faltan tiempos de viaje. En criterio: priorizar, consultar y avisar antes de modificar una salida.',
} as const

export function contenidoPrueba(version: number) {
    if (version >= 2) return PRUEBA_GENERAL
    return {
        titulo: 'Prueba para el área administrativa',
        introduccion: 'Vas a responder mensajes de clientes, cargar pedidos, organizar entregas y resolver un imprevisto. Los datos son ficticios; no se enviará ningún mensaje ni se modificará ningún pedido real.',
        referencia: '',
        textoTipeo: TEXTO_TIPEO,
        reglaAtencion: 'Escribí lo que le enviarías a cada cliente. Si falta información, pedila antes de confirmar.',
        casosWhatsapp: CASOS_WHATSAPP,
        pedidos: PEDIDOS,
        reglaPedidos: 'Usá una fila por chat. Para datos faltantes, escribí “pendiente” en el campo correspondiente y explicá el estado. Fecha: hoy o mañana según el mensaje.',
        reglaRutas: 'Si ves un conflicto o te falta un dato para confirmar el recorrido, señalalo.',
        criterio: 'Mientras cargás pedidos, Eva solicita entrega urgente pero aún no informó la dirección. A la vez, Bruno cambia la cantidad cuando la ruta de hoy ya está preparada. ¿Qué hacés primero, qué verificás y a quién avisás?',
        guiaRevision: 'En atención, buscar preguntas antes de confirmar horarios o cambios; en pedidos, Eva queda pendiente por dirección y Bruno pide 2 paquetes; en rutas, respetar zonas, horarios y capacidad, y señalar que faltan tiempos de viaje; en criterio, avisar y verificar antes de modificar un recorrido.',
    }
}

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
