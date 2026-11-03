export const TIPEO_SEGUNDOS = 120
export const TEXTO_TIPEO_V3 = 'El martes 10 de noviembre, Laura Gómez solicitó 3 cajas de carpetas para Calle 18 Nº 240. El registro debe indicar entrega entre las 10:00 y las 12:00, teléfono 221 555 0148 y una observación: llamar antes de salir. Revisá la cantidad, la fecha y el domicilio antes de guardar.'

type FilaControl = { id: string; nombre: string; articulo: string; cantidad: string; fecha: string; telefono: string }
export const FILAS_CONTROL: { id: string; original: FilaControl; cargado: FilaControl }[] = [
    { id: 'R1', original: { id: 'R1', nombre: 'Ana', articulo: 'Carpetas', cantidad: '5', fecha: '10/11', telefono: '221 555 0101' }, cargado: { id: 'R1', nombre: 'Ana', articulo: 'Carpetas', cantidad: '5', fecha: '10/11', telefono: '221 555 0101' } },
    { id: 'R2', original: { id: 'R2', nombre: 'Luis', articulo: 'Cuadernos', cantidad: '3', fecha: '09/11', telefono: '221 555 0102' }, cargado: { id: 'R2', nombre: 'Luis', articulo: 'Cuadernos', cantidad: '8', fecha: '09/11', telefono: '221 555 0102' } },
    { id: 'R3', original: { id: 'R3', nombre: 'Marta', articulo: 'Hojas', cantidad: '2', fecha: '10/11', telefono: '221 555 0103' }, cargado: { id: 'R3', nombre: 'Marta', articulo: 'Hojas', cantidad: '2', fecha: '10/11', telefono: '221 555 0103' } },
    { id: 'R4', original: { id: 'R4', nombre: 'Diego', articulo: 'Lapiceras', cantidad: '1', fecha: '10/11', telefono: '221 555 0104' }, cargado: { id: 'R4', nombre: 'Diego', articulo: 'Lapiceras', cantidad: '1', fecha: '11/11', telefono: '221 555 0104' } },
    { id: 'R5', original: { id: 'R5', nombre: 'Sofía', articulo: 'Sobres', cantidad: '6', fecha: '09/11', telefono: '221 555 0105' }, cargado: { id: 'R5', nombre: 'Sofía', articulo: 'Sobres', cantidad: '6', fecha: '09/11', telefono: '221 555 0105' } },
    { id: 'R6', original: { id: 'R6', nombre: 'Paula', articulo: 'Archivadores', cantidad: '4', fecha: '10/11', telefono: '221 555 0106' }, cargado: { id: 'R6', nombre: 'Paula', articulo: 'Archivadores', cantidad: '4', fecha: '10/11', telefono: '221 555 0160' } },
    { id: 'R7', original: { id: 'R7', nombre: 'Nora', articulo: 'Etiquetas', cantidad: '3', fecha: '09/11', telefono: '221 555 0107' }, cargado: { id: 'R7', nombre: 'Nora', articulo: 'Etiquetas', cantidad: '3', fecha: '09/11', telefono: '221 555 0107' } },
    { id: 'R8', original: { id: 'R8', nombre: 'Juan', articulo: 'Carpetas', cantidad: '2', fecha: '10/11', telefono: '221 555 0108' }, cargado: { id: 'R8', nombre: 'Juan', articulo: 'Cuadernos', cantidad: '2', fecha: '10/11', telefono: '221 555 0108' } },
]

export const REGLAS_CLIENTES = [
    'La empresa ficticia atiende de lunes a viernes de 9:00 a 18:00.',
    'Las entregas cubren Centro y Norte. El horario se confirma sólo después de consultar disponibilidad.',
    'Un cambio de dirección requiere el número de solicitud y verificar si la entrega ya salió.',
    'Ante un posible cobro duplicado se solicita número de operación y comprobante, y se deriva a Administración. No se promete un reintegro antes de verificarlo.',
]
export const CONSULTAS_CLIENTES = [
    'Estoy en zona Sur. Si hago el pedido ahora, ¿me asegurás la entrega mañana a las 10?',
    'Quiero cambiar la dirección de una entrega para hoy. ¿Ya quedó cambiado? La nueva dirección es Calle 8 Nº 210.',
    'Me cobraron dos veces. Necesito que me devuelvan el dinero hoy. ¿Cómo lo resolvemos?',
]

export const PLANILLA_FILAS = [
    ['S01', 2, 1500, 'Confirmado'],
    ['S02', 3, 2000, 'Pendiente'],
    ['S03', 1, 4500, 'Confirmado'],
    ['S04', 4, 800, 'Cancelado'],
    ['S05', 5, 1200, 'Confirmado'],
    ['S06', 2, 3500, 'Pendiente'],
    ['S07', 3, 900, 'Confirmado'],
    ['S08', 1, 5000, 'Confirmado'],
] as const

export type CeldaPlanilla = { valor: string | number | null; formula: string | null }
export type PlanillaResultado = { origenIntacto: boolean; totales: CeldaPlanilla[]; resumen: CeldaPlanilla[]; nombreArchivo: string }
export type RespuestasV3 = { errores: { id: string; correccion: string }[]; clientes: string[] }

export function validarRespuestasV3(value: unknown): RespuestasV3 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuestas inválidas')
    const input = value as Record<string, unknown>
    if (!Array.isArray(input.errores) || !Array.isArray(input.clientes) || input.clientes.length !== CONSULTAS_CLIENTES.length) throw new Error('Faltan secciones de la prueba')
    const ids = new Set<string>()
    const errores = input.errores.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Control de errores inválido')
        const { id, correccion } = item as Record<string, unknown>
        if (typeof id !== 'string' || !FILAS_CONTROL.some(fila => fila.id === id) || ids.has(id) || typeof correccion !== 'string' || !correccion.trim() || correccion.length > 500) throw new Error('Indicá la corrección de cada fila marcada')
        ids.add(id)
        return { id, correccion: correccion.trim() }
    })
    const clientes = input.clientes.map(value => {
        if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new Error('Respondé las tres consultas')
        return value.trim()
    })
    return { errores, clientes }
}

export function validarRevisionV3(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Revisión inválida')
    const input = value as Record<string, unknown>
    if (!Number.isInteger(input.comunicacion) || (input.comunicacion as number) < 0 || (input.comunicacion as number) > 5) throw new Error('La comunicación se puntúa de 0 a 5')
    if (typeof input.observaciones !== 'string' || input.observaciones.length > 4000) throw new Error('Observaciones inválidas')
    return { comunicacion: input.comunicacion as number, observaciones: input.observaciones.trim() }
}

function distancia(a: string, b: string) {
    const anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        let diagonal = anterior[0]
        anterior[0] = i
        for (let j = 1; j <= b.length; j++) {
            const arriba = anterior[j]
            anterior[j] = Math.min(anterior[j] + 1, anterior[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
            diagonal = arriba
        }
    }
    return anterior[b.length]
}

export function metricasTipeo(texto: string | null, inicio: Date | null, fin: Date | null) {
    if (!inicio || !fin) return null
    const segundos = Math.max(1, Math.min(TIPEO_SEGUNDOS, (fin.getTime() - inicio.getTime()) / 1000))
    const escrito = texto || ''
    const exactitud = Math.max(0, Math.round(100 * (1 - distancia(TEXTO_TIPEO_V3, escrito) / Math.max(TEXTO_TIPEO_V3.length, escrito.length, 1))))
    const palabrasPorMinuto = Math.round((escrito.length / 5) / (segundos / 60))
    return { segundos: Math.round(segundos), exactitud, palabrasPorMinuto, palabrasNetasPorMinuto: Math.round(palabrasPorMinuto * exactitud / 100) }
}

export function metricasErrores(respuestas: RespuestasV3) {
    const marcadas = new Set(respuestas.errores.map(item => item.id))
    const esperadas = new Set(FILAS_CONTROL.filter(fila => Object.keys(fila.original).some(key => fila.original[key as keyof FilaControl] !== fila.cargado[key as keyof FilaControl])).map(fila => fila.id))
    const detectadas = [...marcadas].filter(id => esperadas.has(id)).length
    const falsasAlarmas = [...marcadas].filter(id => !esperadas.has(id)).length
    return { detectadas, erroresReales: esperadas.size, falsasAlarmas, omitidas: esperadas.size - detectadas }
}

export function metricasPlanilla(planilla: PlanillaResultado | null) {
    if (!planilla) return null
    const esperados = PLANILLA_FILAS.map(fila => fila[1] * fila[2])
    const resumen = [PLANILLA_FILAS.reduce((n, fila) => n + (fila[3] === 'Confirmado' ? fila[1] * fila[2] : 0), 0), PLANILLA_FILAS.filter(fila => fila[3] === 'Pendiente').length, Math.max(...esperados)]
    const celdas = [...planilla.totales, ...planilla.resumen]
    const valoresCorrectos = [...esperados, ...resumen].filter((valor, i) => Number(celdas[i]?.valor) === valor).length
    const formulas = celdas.filter(celda => !!celda.formula?.trim()).length
    return { origenIntacto: planilla.origenIntacto, valoresCorrectos, formulas, celdas: celdas.length }
}
