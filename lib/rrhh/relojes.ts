export const ORIGENES_RELOJ = ['FABRICA', 'GUTIERREZ', 'VILLA_ELISA'] as const
export type OrigenReloj = typeof ORIGENES_RELOJ[number]

export const ETIQUETAS_RELOJ: Record<OrigenReloj, string> = {
    FABRICA: 'Fábrica',
    GUTIERREZ: 'Gutiérrez',
    VILLA_ELISA: 'Villa Elisa',
}

export function normalizarCodigoReloj(codigo: unknown): string {
    const valor = String(codigo ?? '').trim()
    if (!valor) return ''
    if (!/^\d+$/.test(valor)) throw new Error('El ID del reloj debe contener sólo números.')
    return valor.replace(/^0+(?=\d)/, '')
}

export function origenRelojDesdeFuente(fuente: string | undefined): OrigenReloj | null {
    if (fuente === 'fabrica_txt') return 'FABRICA'
    if (fuente === 'local_xls') return 'GUTIERREZ'
    if (fuente === 'villa_elisa_xls') return 'VILLA_ELISA'
    return null
}
