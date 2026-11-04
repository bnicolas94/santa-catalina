import type { EstadoPractica, Respuesta } from './tipos'

// Un latido puede llegar después de una escritura más reciente.
export function prepararVista(actual: EstadoPractica | null, nuevo: EstadoPractica, borrador: Respuesta | null, forzar = false) {
    if (actual && (Date.parse(nuevo.ahora) < Date.parse(actual.ahora) || Object.entries(actual.sesiones).some(([modulo, sesion]) => sesion && (!nuevo.sesiones[modulo as keyof typeof nuevo.sesiones] || nuevo.sesiones[modulo as keyof typeof nuevo.sesiones]!.revision < sesion.revision)))) {
        return { aceptado: false, hidratar: false, respuesta: borrador }
    }
    const anterior = actual?.plan.modulos.find(a => !actual.sesiones[a.modulo]?.fin)?.modulo
    const siguiente = nuevo.plan.modulos.find(a => !nuevo.sesiones[a.modulo]?.fin)?.modulo
    const guardada = siguiente ? nuevo.sesiones[siguiente]?.respuesta ?? null : null
    const hidratar = forzar || anterior !== siguiente || (!borrador && !!guardada)
    return { aceptado: true, hidratar, respuesta: hidratar ? guardada : borrador }
}
