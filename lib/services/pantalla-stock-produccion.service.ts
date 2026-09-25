import https from 'node:https'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import {
    calcularPaquetesEnProduccion, calcularProyeccionDias, calcularStockDesdeFoto, COLUMNAS_PANTALLA, HORARIOS_TURNOS_PANTALLA,
    leerDemandasPaqTotales, TURNOS_PANTALLA, turnosVisibles, type CantidadesPantalla, type DemandaPorFecha,
} from '@/lib/produccion/pantalla-stock'

const DURACION_CACHE_MS = 120_000
const MAX_ARCHIVO_BYTES = 10_000_000
const HOSTS_PERMITIDOS = new Set(['1drv.ms', 'onedrive.live.com'])

type LecturaExcel = { demandas: DemandaPorFecha[]; actualizado: string }
let cache: { clave: string; vence: number; promesa: Promise<LecturaExcel> } | undefined

function urlExcel() {
    const valor = process.env.PRODUCCION_PEDIDOS_EXCEL_URL
    if (!valor) throw new Error('Falta configurar PRODUCCION_PEDIDOS_EXCEL_URL.')
    const url = new URL(valor)
    if (url.protocol !== 'https:' || !HOSTS_PERMITIDOS.has(url.hostname)) throw new Error('La URL de OneDrive no es válida.')
    url.searchParams.set('download', '1')
    return url
}

function descargarExcel(url: URL, cookies = new Map<string, Map<string, string>>(), saltos = 0): Promise<Buffer> {
    if (saltos > 5 || url.protocol !== 'https:' || !HOSTS_PERMITIDOS.has(url.hostname)) {
        return Promise.reject(new Error('OneDrive redirigió fuera de los dominios permitidos.'))
    }
    return new Promise((resolve, reject) => {
        const propios = cookies.get(url.hostname)
        const cookie = propios ? [...propios].map(([nombre, valor]) => `${nombre}=${valor}`).join('; ') : ''
        const peticion = https.get(url, {
            headers: {
                Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'User-Agent': 'Mozilla/5.0 (compatible; SantaCatalinaProduccion/1.0)',
                ...(cookie ? { Cookie: cookie } : {}),
            },
            timeout: 20_000,
        }, respuesta => {
            for (const encabezado of respuesta.headers['set-cookie'] ?? []) {
                const par = encabezado.split(';', 1)[0]
                const separador = par.indexOf('=')
                if (separador <= 0) continue
                if (!cookies.has(url.hostname)) cookies.set(url.hostname, new Map())
                cookies.get(url.hostname)!.set(par.slice(0, separador), par.slice(separador + 1))
            }
            const estado = respuesta.statusCode ?? 0
            if (estado >= 300 && estado < 400 && respuesta.headers.location) {
                respuesta.resume()
                resolve(descargarExcel(new URL(respuesta.headers.location, url), cookies, saltos + 1))
                return
            }
            if (estado !== 200) {
                respuesta.resume()
                reject(new Error(`OneDrive respondió ${estado}.`))
                return
            }
            const tipo = respuesta.headers['content-type'] ?? ''
            if (!tipo.includes('spreadsheetml.sheet')) {
                respuesta.resume()
                reject(new Error('OneDrive no devolvió un archivo Excel.'))
                return
            }
            const longitud = Number(respuesta.headers['content-length'] ?? 0)
            if (longitud > MAX_ARCHIVO_BYTES) {
                respuesta.resume()
                reject(new Error('El Excel supera el límite de 10 MB.'))
                return
            }
            const partes: Buffer[] = []
            let tamano = 0
            respuesta.on('data', (parte: Buffer) => {
                tamano += parte.length
                if (tamano > MAX_ARCHIVO_BYTES) {
                    respuesta.destroy(new Error('El Excel supera el límite de 10 MB.'))
                    return
                }
                partes.push(parte)
            })
            respuesta.on('end', () => resolve(Buffer.concat(partes)))
            respuesta.on('error', reject)
        })
        peticion.on('timeout', () => peticion.destroy(new Error('OneDrive no respondió a tiempo.')))
        peticion.on('error', reject)
    })
}

async function descargarExcelConReintento(url: URL) {
    try {
        return await descargarExcel(url)
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : ''
        const codigo = (error as { code?: string } | null)?.code
        if (!/OneDrive respondió (429|500|502|503|504)\.|OneDrive no respondió a tiempo\./.test(mensaje)
            && !['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(codigo ?? '')) throw error
        await new Promise(resolve => setTimeout(resolve, 1_000))
        return descargarExcel(url)
    }
}

async function obtenerDemanda(fecha: string): Promise<LecturaExcel> {
    const url = urlExcel()
    const clave = `${url.toString()}|${fecha}`
    if (!cache || cache.clave !== clave || cache.vence <= Date.now()) {
        const promesa = descargarExcelConReintento(url).then(archivo => {
            const libro = XLSX.read(archivo, { type: 'buffer' })
            const hoja = libro.Sheets['Paq. Totales']
            if (!hoja) throw new Error('El Excel no contiene la pestaña Paq. Totales.')
            const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '', raw: true })
            return { demandas: leerDemandasPaqTotales(filas, fecha), actualizado: new Date().toISOString() }
        })
        const entrada = { clave, vence: Date.now() + DURACION_CACHE_MS, promesa }
        cache = entrada
        void promesa.catch(() => { if (cache === entrada) cache = undefined })
    }
    return cache.promesa
}

function horaArgentina(ahora: Date) {
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(ahora).map(parte => [parte.type, parte.value]))
    return { fecha: `${partes.year}-${partes.month}-${partes.day}`, minutos: Number(partes.hour) * 60 + Number(partes.minute) }
}

async function obtenerFotoInicial(fecha: string, idsPresentacion: string[]) {
    const clave = `produccion:pantalla:stock-inicial:${fecha}`
    const existente = await prisma.configuracionGlobal.findUnique({ where: { clave } })
    if (existente) return JSON.parse(existente.valor) as { tomadoAt: string; cantidades: CantidadesPantalla }
    const stocks = await prisma.stockProducto.findMany({
        where: { presentacionId: { in: idsPresentacion }, ubicacion: { tipo: 'FABRICA' } },
        select: { presentacionId: true, cantidad: true },
    })
    const cantidades: CantidadesPantalla = {}
    for (const stock of stocks) cantidades[stock.presentacionId] = (cantidades[stock.presentacionId] ?? 0) + stock.cantidad
    const valor = JSON.stringify({ tomadoAt: new Date().toISOString(), cantidades })
    const guardado = await prisma.configuracionGlobal.upsert({
        where: { clave }, create: { clave, valor }, update: {},
    })
    return JSON.parse(guardado.valor) as { tomadoAt: string; cantidades: CantidadesPantalla }
}

async function obtenerPantallaStockProduccionUnaVez() {
    const ahora = new Date()
    const { fecha, minutos } = horaArgentina(ahora)
    if (minutos < HORARIOS_TURNOS_PANTALLA.Mañana.inicio) {
        return { estado: 'esperando_inicio' as const, fecha }
    }
    const [excel, presentaciones] = await Promise.all([
        obtenerDemanda(fecha),
        prisma.presentacion.findMany({
            where: { OR: COLUMNAS_PANTALLA.map(columna => ({ cantidad: columna.presentacion, producto: { codigoInterno: columna.codigo } })) },
            select: { id: true, cantidad: true, producto: { select: { codigoInterno: true } } },
        }),
    ])
    const porClave = new Map(presentaciones.map(p => [`${p.producto.codigoInterno}:${p.cantidad}`, p.id]))
    for (const columna of COLUMNAS_PANTALLA) {
        if (!porClave.has(columna.clave)) throw new Error(`Falta configurar la presentación ${columna.encabezado} en el ERP.`)
    }
    const ids = [...porClave.values()]
    const foto = await obtenerFotoInicial(fecha, ids)
    const finDia = new Date(`${fecha}T00:00:00Z`)
    finDia.setUTCDate(finDia.getUTCDate() + 1)
    const [movimientos, lotesEnProduccion] = await Promise.all([
        prisma.movimientoProducto.findMany({
            where: {
                presentacionId: { in: ids }, ubicacion: { tipo: 'FABRICA' },
                fecha: { gte: new Date(`${fecha}T09:00:00-03:00`), lte: ahora },
                OR: [
                    { tipo: 'ajuste' },
                    { tipo: 'traslado' },
                    { loteId: { not: null }, tipo: { in: ['produccion', 'ajuste_produccion', 'anulacion_produccion'] } },
                ],
            },
            select: { presentacionId: true, signo: true, cantidad: true, tipo: true, fecha: true },
        }),
        prisma.lote.findMany({
            where: {
                estado: 'en_produccion', ubicacion: { tipo: 'FABRICA' },
                fechaProduccion: { gte: new Date(`${fecha}T00:00:00Z`), lt: finDia },
            },
            select: { unidadesProducidas: true, distribucion: true },
        }),
    ])
    const { inicial: inicialPorId, producido: producidoPorId, traslados: trasladosPorId, ultimoAjuste } = calcularStockDesdeFoto(foto, movimientos)
    const enProduccionPorId = calcularPaquetesEnProduccion(lotesEnProduccion)
    const inicial: CantidadesPantalla = {}
    const producido: CantidadesPantalla = {}
    const salidas: CantidadesPantalla = {}
    const entradas: CantidadesPantalla = {}
    for (const columna of COLUMNAS_PANTALLA) {
        const id = porClave.get(columna.clave)!
        inicial[columna.clave] = inicialPorId[id] ?? 0
        producido[columna.clave] = producidoPorId[id] ?? 0
        salidas[columna.clave] = trasladosPorId.salidas[id] ?? 0
        entradas[columna.clave] = trasladosPorId.entradas[id] ?? 0
    }
    const dias = calcularProyeccionDias(inicial, producido, excel.demandas, { salidas, entradas })
        .map((dia, indice) => ({
            ...dia,
            columnas: dia.columnas.map(columna => ({
                ...columna,
                enProduccion: indice === 0 ? enProduccionPorId[porClave.get(columna.clave)!] ?? 0 : 0,
            })),
            turnosVisibles: indice === 0 ? turnosVisibles(minutos) : [...TURNOS_PANTALLA],
        }))
    return {
        estado: 'listo' as const, fecha, actualizadoExcel: excel.actualizado,
        stockTomadoAt: foto.tomadoAt, stockAjustadoAt: ultimoAjuste?.toISOString() ?? null,
        dias,
    }
}

export function esFallaTransitoriaDeBase(error: unknown) {
    const codigo = (error as { code?: string } | null)?.code
    const mensaje = error instanceof Error ? error.message : ''
    return ['P1001', 'P1002', 'P1017'].includes(codigo ?? '')
        || /Can't reach database server|Server has closed the connection|Connection terminated unexpectedly/i.test(mensaje)
}

export async function obtenerPantallaStockProduccion() {
    for (let intento = 0; intento < 3; intento++) {
        try {
            return await obtenerPantallaStockProduccionUnaVez()
        } catch (error) {
            if (intento === 2 || !esFallaTransitoriaDeBase(error)) throw error
            await new Promise(resolve => setTimeout(resolve, (intento + 1) * 700))
        }
    }
    throw new Error('No se pudo consultar el stock de producción.')
}
