export class DiarioError extends Error {}

export function objeto(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DiarioError('Datos inválidos')
    return input as Record<string, unknown>
}

export function texto(value: unknown, campo: string, max: number, opcional = false): string {
    if (opcional && (value === undefined || value === null)) return ''
    if (typeof value !== 'string') throw new DiarioError(`${campo}: ingresá un texto válido`)
    const result = value.trim()
    if ((!opcional && !result) || result.length > max) throw new DiarioError(`${campo}: ${opcional ? 'hasta' : 'entre 1 y'} ${max} caracteres`)
    return result
}

export function fechaValida(value: unknown): string {
    const fecha = texto(value, 'Fecha', 10)
    const date = new Date(`${fecha}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== fecha) throw new DiarioError('Ingresá una fecha válida')
    return fecha
}

export function validarRegistro(input: unknown) {
    const data = objeto(input)
    if (data.solucionado !== undefined && typeof data.solucionado !== 'boolean') throw new DiarioError('Indicá si el incidente se pudo solucionar')
    return {
        fecha: fechaValida(data.fecha),
        areaId: texto(data.areaId, 'Área', 100),
        error: texto(data.error, 'Error', 4000),
        responsable: texto(data.responsable, 'Responsable', 150),
        solucion: texto(data.solucion, 'Solución brindada', 4000, true),
        // Los clientes anteriores pueden omitir el campo; una edición conserva su estado.
        ...(data.solucionado !== undefined ? { solucionado: data.solucionado as boolean } : {}),
    }
}

export function validarArea(input: unknown) {
    const data = objeto(input)
    const nombre = texto(data.nombre, 'Nombre del área', 80).replace(/\s+/g, ' ')
    if (data.activa !== undefined && typeof data.activa !== 'boolean') throw new DiarioError('Estado de área inválido')
    return { nombre, clave: nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR'), activa: data.activa !== false }
}

export function filtrosDiario(params: URLSearchParams) {
    const desde = params.get('desde') ? fechaValida(params.get('desde')) : undefined
    const hasta = params.get('hasta') ? fechaValida(params.get('hasta')) : undefined
    if (desde && hasta && desde > hasta) throw new DiarioError('La fecha inicial no puede ser posterior a la final')
    const q = texto(params.get('q') || '', 'Búsqueda', 150, true)
    const areaId = texto(params.get('areaId') || '', 'Área', 100, true)
    return {
        ...(desde || hasta ? { fecha: { gte: desde, lte: hasta } } : {}),
        ...(areaId ? { areaId } : {}),
        ...(q ? { OR: ['error', 'responsable', 'solucion'].map(campo => ({ [campo]: { contains: q, mode: 'insensitive' as const } })) } : {}),
    }
}

export function resumirIncidentes(grupos: { solucionado: boolean | null; _count: { _all: number } }[]) {
    const resumen = { total: 0, solucionados: 0, noSolucionados: 0, sinConfirmar: 0 }
    for (const grupo of grupos) {
        const cantidad = grupo._count._all
        resumen.total += cantidad
        if (grupo.solucionado === true) resumen.solucionados += cantidad
        else if (grupo.solucionado === false) resumen.noSolucionados += cantidad
        else resumen.sinConfirmar += cantidad
    }
    return resumen
}

export function estadoSolucion(solucionado: boolean | null | undefined) {
    return solucionado === true ? 'Solucionado' : solucionado === false ? 'No solucionado' : 'Sin confirmar'
}

export function diarioCSV(registros: { fecha: string; area: { nombre: string }; error: string; responsable: string; solucion: string; solucionado?: boolean | null; creadoPorNombre: string }[]) {
    const celda = (valor: string) => `"${(/^[\s]*[=+@-]/.test(valor) ? "'" + valor : valor).replace(/"/g, '""')}"`
    return '\uFEFF' + [['Fecha', 'Área', 'Error', 'Responsable', 'Solución brindada', 'Estado de solución', 'Registrado por'], ...registros.map(r => [r.fecha, r.area.nombre, r.error, r.responsable, r.solucion, estadoSolucion(r.solucionado), r.creadoPorNombre])].map(row => row.map(celda).join(';')).join('\r\n')
}
