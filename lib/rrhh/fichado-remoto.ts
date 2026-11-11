export type AccionFichadoRemoto = 'entrada' | 'inicio_descanso' | 'fin_descanso' | 'salida'
export type EstadoFichadoRemoto = 'sin_iniciar' | 'trabajando' | 'descansando' | 'finalizado'

export type MarcaFichado = { tipo: string; origen: string; fechaHora: Date }

export const ORIGEN_FICHADO_REMOTO: Record<AccionFichadoRemoto, string> = {
    entrada: 'remoto_entrada',
    inicio_descanso: 'remoto_inicio_descanso',
    fin_descanso: 'remoto_fin_descanso',
    salida: 'remoto_salida',
}

export function tipoParaAccionRemota(accion: AccionFichadoRemoto): 'entrada' | 'salida' {
    return accion === 'entrada' || accion === 'fin_descanso' ? 'entrada' : 'salida'
}

export function estadoFichadoRemoto(marcas: MarcaFichado[]): EstadoFichadoRemoto {
    if (marcas.length === 0) return 'sin_iniciar'
    const ultima = marcas[marcas.length - 1]
    if (ultima.origen === ORIGEN_FICHADO_REMOTO.inicio_descanso) return 'descansando'
    if (ultima.origen === ORIGEN_FICHADO_REMOTO.salida) return 'finalizado'
    return ultima.tipo.toLowerCase() === 'entrada' ? 'trabajando' : 'finalizado'
}

export function accionPermitida(estado: EstadoFichadoRemoto, accion: AccionFichadoRemoto): boolean {
    return (estado === 'sin_iniciar' && accion === 'entrada')
        || (estado === 'trabajando' && (accion === 'inicio_descanso' || accion === 'salida'))
        || (estado === 'descansando' && accion === 'fin_descanso')
}

export function esAccionFichadoRemoto(valor: unknown): valor is AccionFichadoRemoto {
    return typeof valor === 'string' && Object.hasOwn(ORIGEN_FICHADO_REMOTO, valor)
}
