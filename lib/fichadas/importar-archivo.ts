import { instanteRRHH } from '@/lib/rrhh/fechas'

export type TipoFichadaImportada = 'entrada' | 'salida'

export interface RegistroFichadaArchivo {
    idTemp: string
    codigoBiometrico: string
    fechaHora: string
    tipo: TipoFichadaImportada
    originalStr: string
    nombreOrigen?: string
    fuente: 'fabrica_txt' | 'local_xls'
}

export interface ResultadoParseoFichadas {
    formato: 'Fichero de fábrica' | 'Reporte mensual del local'
    registros: RegistroFichadaArchivo[]
    advertencias: string[]
}

type CeldaPlanilla = string | number | boolean | Date | null | undefined

function identificadorRegistro(
    fuente: RegistroFichadaArchivo['fuente'],
    codigo: string,
    fechaHora: string,
    tipo: TipoFichadaImportada,
    indice: number,
) {
    return `${fuente}-${codigo}-${fechaHora}-${tipo}-${indice}`
}

function advertenciasPorMarcas(registros: RegistroFichadaArchivo[]): string[] {
    const porEmpleadoDia = new Map<string, RegistroFichadaArchivo[]>()

    for (const registro of registros) {
        const fecha = registro.fechaHora.slice(0, 10)
        const key = `${registro.codigoBiometrico}|${fecha}`
        const actuales = porEmpleadoDia.get(key) || []
        actuales.push(registro)
        porEmpleadoDia.set(key, actuales)
    }

    const advertencias: string[] = []
    for (const marcas of porEmpleadoDia.values()) {
        const ordenadas = [...marcas].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
        const secuenciaValida = ordenadas.every((marca, indice) =>
            marca.tipo === (indice % 2 === 0 ? 'entrada' : 'salida'))

        if (ordenadas.length % 2 !== 0 || !secuenciaValida) {
            const primera = ordenadas[0]
            const nombre = primera.nombreOrigen?.trim() || `reloj ${primera.codigoBiometrico}`
            const [anio, mes, dia] = primera.fechaHora.slice(0, 10).split('-')
            advertencias.push(`${nombre} (${dia}/${mes}/${anio}): faltan o están desordenadas las marcas.`)
        }
    }

    return advertencias
}

export function parsearFicheroFabrica(texto: string): ResultadoParseoFichadas {
    const marcasPorDia = new Map<string, string[]>()

    for (const linea of texto.split(/\r?\n/)) {
        const columnas = linea.split(/\t|\s{2,}/).map(columna => columna.trim()).filter(Boolean)
        if (columnas.length < 4) continue

        const codigoCrudo = columnas[2]
        if (!/^\d+$/.test(codigoCrudo)) continue

        const coincidencia = linea.match(/(\d{4}[\/-]\d{2}[\/-]\d{2})\s+(\d{2}:\d{2}:\d{2})/)
        if (!coincidencia) continue

        const codigo = Number.parseInt(codigoCrudo, 10).toString()
        const fecha = coincidencia[1].replace(/\//g, '-')
        const key = `${codigo}|${fecha}`
        const actuales = marcasPorDia.get(key) || []
        actuales.push(coincidencia[2])
        marcasPorDia.set(key, actuales)
    }

    const registros: RegistroFichadaArchivo[] = []
    for (const [key, horas] of marcasPorDia.entries()) {
        const [codigo, fecha] = key.split('|')
        horas.sort()
        horas.forEach((hora, indice) => {
            const tipo: TipoFichadaImportada = indice % 2 === 0 ? 'entrada' : 'salida'
            const fechaHora = instanteRRHH(fecha, hora).toISOString()
            registros.push({
                idTemp: identificadorRegistro('fabrica_txt', codigo, fechaHora, tipo, indice),
                codigoBiometrico: codigo,
                fechaHora,
                tipo,
                originalStr: `${fecha} ${hora}`,
                fuente: 'fabrica_txt',
            })
        })
    }

    registros.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
    return {
        formato: 'Fichero de fábrica',
        registros,
        advertencias: advertenciasPorMarcas(registros),
    }
}

function textoCelda(valor: CeldaPlanilla): string {
    if (valor === null || valor === undefined) return ''
    return String(valor).trim()
}

function extraerHora(valor: CeldaPlanilla): string | null {
    const coincidencia = textoCelda(valor).match(/^(\d{1,2}):(\d{2})/)
    if (!coincidencia) return null

    const hora = Number(coincidencia[1])
    const minutos = Number(coincidencia[2])
    if (hora > 23 || minutos > 59) return null
    return `${String(hora).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`
}

function extraerAnioPeriodo(fila: CeldaPlanilla[]): number | null {
    const textoPeriodo = fila.map(textoCelda).find(texto => texto.toLowerCase().startsWith('date:')) || ''
    const coincidencia = textoPeriodo.match(/date:\s*(\d{2,4})\.(\d{2})\.(\d{2})/i)
    if (!coincidencia) return null

    const anio = Number(coincidencia[1])
    return anio < 100 ? 2000 + anio : anio
}

function extraerDatoPrefijado(fila: CeldaPlanilla[], prefijo: string): string {
    const texto = fila.map(textoCelda).find(valor => valor.toLowerCase().startsWith(prefijo.toLowerCase())) || ''
    return texto.slice(prefijo.length).trim()
}

function fechaCivilReporte(fecha: string, anio: number): string | null {
    const coincidencia = fecha.match(/^(\d{1,2})\.(\d{1,2})$/)
    if (!coincidencia) return null

    const mes = Number(coincidencia[1])
    const dia = Number(coincidencia[2])
    const control = new Date(Date.UTC(anio, mes - 1, dia))
    if (control.getUTCFullYear() !== anio || control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) {
        return null
    }

    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function parsearReporteMensualLocal(filas: CeldaPlanilla[][]): ResultadoParseoFichadas {
    const registros: RegistroFichadaArchivo[] = []
    let bloquesDetectados = 0

    for (let indiceCabecera = 0; indiceCabecera < filas.length; indiceCabecera++) {
        const filaCabecera = filas[indiceCabecera] || []
        const codigo = extraerDatoPrefijado(filaCabecera, 'number:')
        const anio = extraerAnioPeriodo(filaCabecera)
        if (!codigo || anio === null) continue

        bloquesDetectados++
        const nombreOrigen = extraerDatoPrefijado(filaCabecera, 'name:')

        for (let indiceFila = indiceCabecera + 1; indiceFila < filas.length; indiceFila++) {
            const fila = filas[indiceFila] || []
            if (indiceFila > indiceCabecera + 1 && extraerDatoPrefijado(fila, 'number:')) break

            const mitades = [
                { fechaCol: 0, pares: [[2, 3], [4, 5], [6, 7]] },
                { fechaCol: 9, pares: [[11, 12], [13, 14], [15, 16]] },
            ]

            for (const mitad of mitades) {
                const fechaCivil = fechaCivilReporte(textoCelda(fila[mitad.fechaCol]), anio)
                if (!fechaCivil) continue

                for (const [entradaCol, salidaCol] of mitad.pares) {
                    const marcas: Array<{ columna: number, tipo: TipoFichadaImportada }> = [
                        { columna: entradaCol, tipo: 'entrada' },
                        { columna: salidaCol, tipo: 'salida' },
                    ]

                    for (const marca of marcas) {
                        const hora = extraerHora(fila[marca.columna])
                        if (!hora) continue

                        const fechaHora = instanteRRHH(fechaCivil, hora).toISOString()
                        registros.push({
                            idTemp: identificadorRegistro(
                                'local_xls',
                                codigo,
                                fechaHora,
                                marca.tipo,
                                registros.length,
                            ),
                            codigoBiometrico: codigo,
                            fechaHora,
                            tipo: marca.tipo,
                            originalStr: `${fechaCivil} ${hora.slice(0, 5)}`,
                            nombreOrigen: nombreOrigen || undefined,
                            fuente: 'local_xls',
                        })
                    }
                }
            }
        }
    }

    if (bloquesDetectados === 0) {
        throw new Error('El Excel no tiene el formato de reporte mensual del reloj del local.')
    }

    registros.sort((a, b) => {
        const porCodigo = a.codigoBiometrico.localeCompare(b.codigoBiometrico)
        return porCodigo || a.fechaHora.localeCompare(b.fechaHora)
    })

    return {
        formato: 'Reporte mensual del local',
        registros,
        advertencias: advertenciasPorMarcas(registros),
    }
}
