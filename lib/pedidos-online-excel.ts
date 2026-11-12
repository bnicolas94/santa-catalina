import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { normalizarTexto } from '@/lib/google-sheets-caja'

export type FilaPedidoOnline = {
    externalId: string
    fila: number
    fechaHora: string
    nombre: string
    apellido: string
    telefono: string
    direccion: string
    producto: string
    modalidad: string
    estado: string
    fechaEntrega: string
    observaciones: string
    huella: string
    duplicado: boolean
}

export type PedidoExcel = {
    fecha: string
    nombre: string
    pedido: string
    cantidad: number
    calle: string
    telefono: string
    horario: string
    entrega: string
}

const sabores: Record<string, string> = {
    tomate: 'tom', lechuga: 'lechu', 'zanahoria y huevo': 'zyh',
    'zanahoria y queso': 'zyq', huevo: 'hue', aceituna: 'ace',
    'jamon y queso': 'jyq', choclo: 'cho', anana: 'anana', atun: 'atun',
    berenjena: 'beren', crudo: 'crudo', 'jamon crudo': 'crudo', roquefort: 'roque', panceta: 'panceta',
    pacenta: 'panceta', palmito: 'palmito', salame: 'salame',
    morron: 'morron', pollo: 'pollo',
}

function clave(valor: unknown) {
    return normalizarTexto(valor).replace(/[^a-z0-9]/g, '')
}

function fechaIso(valor: string): string | null {
    const texto = valor.trim()
    const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/)
    if (!match) return null
    const [, dia, mes, anio] = match
    const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)))
    if (fecha.getUTCFullYear() !== Number(anio) || fecha.getUTCMonth() !== Number(mes) - 1 || fecha.getUTCDate() !== Number(dia)) return null
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

export function parsearCsvPedidosOnline(csv: string): FilaPedidoOnline[] {
    const libro = XLSX.read(csv, { type: 'string', raw: true })
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: '', raw: true })
    if (!matriz.length) return []
    const indices = new Map(matriz[0].map((valor, indice) => [clave(valor), indice]))
    const columnasObservaciones = matriz[0]
        .map((valor, indice) => ({ nombre: clave(valor), indice }))
        .filter(({ nombre }) => /^(observacion|observaciones|comentario|comentarios|notas)/.test(nombre))
    for (const campo of ['id', 'fechahora', 'nombre', 'apellido', 'telefono', 'direccion', 'producto', 'modalidad', 'estado', 'fechaentrega']) {
        if (!indices.has(campo)) throw new Error(`Pedidos_online no contiene la columna ${campo}.`)
    }
    const porId = new Map<string, FilaPedidoOnline>()
    for (const [indice, fila] of matriz.slice(1).entries()) {
        const obtener = (campo: string) => String(fila[indices.get(campo)!] ?? '').trim()
        const externalId = obtener('id')
        if (!externalId) continue
        // El Sheet ha usado encabezados distintos para los comentarios. Se leen
        // todas las columnas de observaciones disponibles, sin mezclar Producto.
        const observaciones = columnasObservaciones
            .map(({ indice: posicion }) => String(fila[posicion] ?? '').trim())
            .filter(Boolean).join('\n')
        const datos = {
            externalId, fila: indice + 2, fechaHora: obtener('fechahora'), nombre: obtener('nombre'),
            apellido: obtener('apellido'), telefono: obtener('telefono'), direccion: obtener('direccion'),
            producto: obtener('producto'), modalidad: obtener('modalidad'), estado: obtener('estado'),
            fechaEntrega: obtener('fechaentrega'), observaciones,
        }
        const huella = createHash('sha256').update(JSON.stringify({ ...datos, fila: undefined })).digest('hex')
        const anterior = porId.get(externalId)
        if (anterior) {
            anterior.duplicado = true
            continue
        }
        porId.set(externalId, { ...datos, huella, duplicado: false })
    }
    return [...porId.values()].map(fila => fila.duplicado
        ? { ...fila, huella: createHash('sha256').update(`${fila.huella}:duplicado`).digest('hex') }
        : fila)
}

export function esDelivery(fila: FilaPedidoOnline) {
    return normalizarTexto(fila.modalidad) === 'delivery'
}

export function estaCancelado(fila: FilaPedidoOnline) {
    return /^(cancelad[oa]|anulad[oa])$/.test(normalizarTexto(fila.estado))
}

function codigoCerrado(nombre: string) {
    if (nombre === 'jamon y queso') return 'jyq'
    if (/^surtidos? clasicos?$/.test(nombre)) return 'clasicos'
    if (/^surtidos? especiales?$/.test(nombre)) return 'esp'
    return null
}

function parsearElegidos(observaciones: string, cantidadEsperada: number): string[] | null {
    const texto = observaciones.split(/\r?\n/).map(normalizarTexto).join('\n')
    const seccion = texto.match(/sabores\s*\(\s*\d+\s*\)\s*:\s*([^\n]+)/)?.[1]
    if (!seccion) return null
    const partes = seccion.split(/\s*(?:\+|,|;)\s*/).filter(Boolean)
    const codigos: string[] = []
    let total = 0
    for (const parte of partes) {
        const match = parte.match(/^(\d+)\s*x\s*(.+)$/)
        if (!match) return null
        const cantidad = Number(match[1])
        const codigo = sabores[match[2].trim()]
        if (!codigo || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad % 8 !== 0) return null
        codigos.push(`${cantidad}${codigo}`)
        total += cantidad
    }
    return total === cantidadEsperada ? codigos : null
}

export function convertirPedidoOnline(fila: FilaPedidoOnline): { pedido: PedidoExcel | null; error: string | null } {
    if (fila.duplicado) return { pedido: null, error: 'El ID está duplicado en Google Sheets.' }
    const fecha = fechaIso(fila.fechaHora)
    const entrega = fechaIso(fila.fechaEntrega)
    if (!fecha || !entrega) return { pedido: null, error: 'La fecha de creación o entrega no es válida.' }
    if (!fila.nombre && !fila.apellido) return { pedido: null, error: 'Falta el nombre del cliente.' }
    if (!fila.direccion || !fila.telefono) return { pedido: null, error: 'Falta dirección o teléfono.' }
    const turno = fila.observaciones.match(/turno\s*:\s*([^\r\n]+)/i)?.[1]?.trim()
    if (!turno || !['manana', 'siesta', 'tarde'].includes(normalizarTexto(turno))) {
        return { pedido: null, error: 'Falta un turno válido en observaciones.' }
    }
    const codigos: string[] = []
    let unidades = 0
    for (const parte of normalizarTexto(fila.producto).split(/\s*\+\s*/).filter(Boolean)) {
        const match = parte.match(/^(?:(\d+)\s*x\s*)?(\d+)\s+(.+)$/)
        if (!match) return { pedido: null, error: `Producto sin equivalencia: ${parte}.` }
        const paquetes = Number(match[1] ?? 1)
        const cantidad = Number(match[2])
        const nombre = match[3].trim()
        if (!Number.isSafeInteger(paquetes) || paquetes < 1 || paquetes > 100 || !Number.isSafeInteger(cantidad) || cantidad < 1) {
            return { pedido: null, error: 'Cantidad de producto inválida.' }
        }
        const total = paquetes * cantidad
        if (nombre === 'surtidos elegidos') {
            const elegidos = parsearElegidos(fila.observaciones, total)
            if (!elegidos) return { pedido: null, error: 'Los sabores elegidos no coinciden con el producto.' }
            codigos.push(...elegidos)
        } else {
            const cerrado = codigoCerrado(nombre)
            const sabor = sabores[nombre]
            if (!cerrado && !sabor) return { pedido: null, error: `Producto sin equivalencia: ${nombre}.` }
            codigos.push(`${total}${cerrado ?? sabor}`)
        }
        unidades += total
    }
    if (!codigos.length || unidades % 8 !== 0) return { pedido: null, error: 'El total no equivale a planchas enteras.' }
    return { pedido: {
        fecha, nombre: [fila.nombre, fila.apellido].filter(Boolean).join(' '), pedido: codigos.join(' '),
        cantidad: unidades / 8, calle: fila.direccion, telefono: fila.telefono,
        horario: turno, entrega,
    }, error: null }
}
