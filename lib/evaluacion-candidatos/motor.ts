import type { Asignacion, ConfigModulo, Modulo, Plan, Respuesta, Sesion, Mensaje } from './tipos'
import { NOMBRES } from './tipos'

export function validarConfig(valor: unknown): ConfigModulo[] {
    if (!Array.isArray(valor) || valor.length !== 5) throw new Error('Configurá los cinco módulos')
    const vistos = new Set<string>()
    const maximos = { TIPEO: 1, PLANILLA: 4, CONVERSACIONES: 12, DETALLE: 5, ATENCION: 4 }
    const config = valor.map(c => {
        if (!c || typeof c !== 'object' || !Object.hasOwn(NOMBRES, c.modulo) || vistos.has(c.modulo)) throw new Error('Módulos inválidos o repetidos')
        vistos.add(c.modulo)
        if (!Number.isInteger(c.segundos) || c.segundos < 30 || c.segundos > 3600 || !Number.isInteger(c.cantidad) || c.cantidad < 1 || c.cantidad > maximos[c.modulo as Modulo] || typeof c.activo !== 'boolean') throw new Error('Duración: 30–3600 segundos; cantidad dentro del banco disponible')
        return { modulo: c.modulo as Modulo, segundos: c.segundos, cantidad: c.cantidad, activo: c.activo }
    })
    if (!config.some(c => c.activo)) throw new Error('Activá al menos un módulo')
    return config
}
export function respuestaInicial(a: Asignacion): Respuesta {
    const tablas: Respuesta['tablas'] = {}
    for (const e of a.ejercicios) if (e.filas) tablas[e.id] = structuredClone(e.filas)
    if (a.modulo === 'CONVERSACIONES') tablas.pedidos = a.ejercicios.map(e => [e.id, ...Array(10).fill('')])
    return { texto: '', tablas, vistas: {}, textos: {}, marcas: [] }
}
export function tiempoActivo(s: Sesion, ahora: number) { return Math.max(0, (s.fin ? Date.parse(s.fin) : s.pausa ? Date.parse(s.pausa) : ahora) - Date.parse(s.inicio) - s.pausadoMs) }
export function validarLease(actual: string | null, hasta: Date | null, presentado: string, tomar: boolean, ahora: number) {
    if (actual !== presentado && hasta && hasta.getTime() > ahora) throw new Error('Esta evaluación está abierta en otra sesión. Cerrala o esperá 45 segundos sin actividad para recuperarla')
    if (!tomar && actual !== presentado) throw new Error('Recuperá la sesión antes de continuar')
}
export function validarRespuesta(valor: unknown, a: Asignacion): Respuesta {
    if (!valor || typeof valor !== 'object' || JSON.stringify(valor).length > 100000) throw new Error('Respuesta demasiado grande o inválida')
    const r = valor as Respuesta
    if (typeof r.texto !== 'string' || r.texto.length > 2000 || !r.tablas || !r.textos || !r.vistas || !Array.isArray(r.marcas) || r.marcas.length > 100) throw new Error('Respuesta inválida')
    const inicial = respuestaInicial(a)
    for (const [clave, filas] of Object.entries(r.tablas)) {
        if (!inicial.tablas[clave] || !Array.isArray(filas) || filas.length !== inicial.tablas[clave].length || filas.some((f, i) => !Array.isArray(f) || f.length !== inicial.tablas[clave][i].length || f.some(v => typeof v !== 'string' || v.length > 500))) throw new Error('Dimensiones o celdas inválidas')
    }
    if (Object.keys(inicial.tablas).some(k => !r.tablas[k])) throw new Error('Falta una planilla')
    if (a.modulo === 'CONVERSACIONES' && r.tablas.pedidos.some((f, i) => f[0] !== inicial.tablas.pedidos[i][0])) throw new Error('No se puede cambiar el identificador del pedido')
    const ids = new Set(a.ejercicios.map(e => e.id))
    if (Object.entries(r.textos).some(([k, v]) => !ids.has(k) || typeof v !== 'string' || v.length > 3000) || r.marcas.some(k => typeof k !== 'string' || !ids.has(k))) throw new Error('Ejercicio inválido')
    for (const [k, v] of Object.entries(r.vistas)) if (!inicial.tablas[k] || !v || typeof v.buscar !== 'string' || v.buscar.length > 100 || typeof v.filtro !== 'string' || v.filtro.length > 100 || !Number.isInteger(v.columna) || !Number.isInteger(v.orden) || v.columna < 0 || v.orden < 0 || v.columna >= (inicial.tablas[k][0]?.length ?? 0) || v.orden >= (inicial.tablas[k][0]?.length ?? 0) || typeof v.descendente !== 'boolean') throw new Error('Filtro inválido')
    return { texto: r.texto, tablas: r.tablas, vistas: r.vistas, textos: r.textos, marcas: [...new Set(r.marcas)] }
}
export function metricasTipeo(original: string, escrito: string, milisegundos: number) {
    let fila = Array.from({ length: original.length + 1 }, (_, i) => i)
    for (let i = 1; i <= escrito.length; i++) {
        const nueva = [i]
        for (let j = 1; j <= original.length; j++) nueva[j] = Math.min(nueva[j - 1] + 1, fila[j] + 1, fila[j - 1] + (escrito[i - 1] === original[j - 1] ? 0 : 1))
        fila = nueva
    }
    const errores = fila[original.length], minutos = Math.max(1, milisegundos) / 60000
    return { caracteres: escrito.length, segundos: milisegundos / 1000, ppm: escrito.length / 5 / minutos, cpm: escrito.length / minutos, errores, exactitud: Math.max(0, 100 * (1 - errores / Math.max(1, original.length, escrito.length))) }
}
export function guardarSesion(s: Sesion, a: Asignacion, input: unknown, revision: number, cerrar: boolean, ahora = Date.now()): Sesion {
    if (s.fin) { if (cerrar) return s; throw new Error('El módulo ya está cerrado') }
    if (s.pausa) throw new Error('El módulo está pausado por Personal')
    if (revision !== s.revision) throw new Error('Hay una versión más reciente. Recuperá el progreso antes de guardar')
    const activo = tiempoActivo(s, ahora)
    if (cerrar && a.modulo === 'CONVERSACIONES' && activo < Math.max(0, ...a.ejercicios.flatMap(e => e.mensajes?.map(m => m.segundo * 1000) ?? []))) throw new Error('Todavía hay actualizaciones programadas. Revisá los mensajes nuevos antes de finalizar')
    if (activo > a.segundos * 1000 + 60000) throw new Error('Se agotó el plazo y la tolerancia de 60 segundos. Contactá a Personal para una reanudación autorizada; el progreso confirmado está conservado')
    const respuesta = validarRespuesta(input, a)
    const historial = [...s.historial]
    const agregar = (tipo: string, detalle: string) => historial.push({ fecha: new Date(ahora).toISOString(), tipo, detalle })
    for (const [id, filas] of Object.entries(respuesta.tablas)) filas.forEach((f, i) => f.forEach((valor, j) => { const anterior = s.respuesta.tablas[id]?.[i]?.[j] ?? ''; if (valor !== anterior) agregar('CELDA', `${id} fila ${i + 1}, columna ${j + 1}: ${anterior} → ${valor}`) }))
    if (respuesta.texto !== s.respuesta.texto) agregar('TIPEO', `${respuesta.texto.length} caracteres guardados`)
    if (JSON.stringify(respuesta.textos) !== JSON.stringify(s.respuesta.textos)) agregar('REDACCION', 'Respuestas actualizadas')
    if (JSON.stringify(respuesta.vistas) !== JSON.stringify(s.respuesta.vistas)) agregar('VISTA', JSON.stringify(respuesta.vistas))
    if (JSON.stringify(respuesta.marcas) !== JSON.stringify(s.respuesta.marcas)) agregar('REVISION', respuesta.marcas.join(', '))
    const fin = cerrar || activo >= a.segundos * 1000 || (a.modulo === 'TIPEO' && respuesta.texto === a.ejercicios[0].texto)
    if (fin) agregar('FIN', activo >= a.segundos * 1000 ? 'Límite de tiempo' : 'Entrega')
    return { ...s, respuesta, revision: s.revision + 1, fin: fin ? new Date(ahora).toISOString() : null, historial: historial.slice(-2500), ...(fin && a.modulo === 'TIPEO' ? { metricas: metricasTipeo(a.ejercicios[0].texto!, respuesta.texto, activo) } : {}) }
}
export function mensajeDisponible(m: Mensaje, s: Sesion | undefined, ahora: number) {
    return m.segundo * 1000 <= (s ? tiempoActivo(s, ahora) : 0) && (!m.requiereRegistro || !!s?.respuesta.tablas.pedidos?.find(f => f[0] === m.id.split('-')[0])?.slice(1).some(v => v.trim()))
}
export function planPublico(plan: Plan, sesiones: Partial<Record<Modulo, Sesion>>, ahora = Date.now()) {
    return { version: plan.version, variante: plan.variante, modulos: plan.modulos.map(a => ({ ...a, ejercicios: a.ejercicios.map(e => ({ ...e, mensajes: e.mensajes?.filter(m => mensajeDisponible(m, sesiones[a.modulo], ahora)) })) })) }
}
