import * as XLSX from 'xlsx'
import { PLANILLA_FILAS, type CeldaPlanilla, type PlanillaResultado } from './habilidades'

export function crearPlanilla() {
    const libro = XLSX.utils.book_new()
    const instrucciones = XLSX.utils.aoa_to_sheet([
        ['Prueba de planilla · instrucciones'],
        ['1. En Datos!E2:E9, escribí una fórmula en cada fila: Cantidad × Precio unitario. Calculá todas las filas, incluso las pendientes y canceladas.'],
        ['2. En Resumen!B2, sumá los totales de las filas con Estado Confirmado.'],
        ['3. En Resumen!B3, contá las filas con Estado Pendiente.'],
        ['4. En Resumen!B4, calculá el mayor total individual de Datos!E2:E9.'],
        ['Guardá el archivo como .xlsx y subilo a la prueba. No cambies los datos de las columnas A:D. Podés usar Excel, LibreOffice o Google Sheets.'],
    ])
    const datos = XLSX.utils.aoa_to_sheet([['ID', 'Cantidad', 'Precio unitario', 'Estado', 'Total'], ...PLANILLA_FILAS.map(fila => [...fila, null])])
    const resumen = XLSX.utils.aoa_to_sheet([['Indicador', 'Resultado'], ['Total confirmado', null], ['Cantidad pendiente', null], ['Mayor total individual', null]])
    datos['!ref'] = 'A1:E9'
    resumen['!ref'] = 'A1:B4'
    instrucciones['!cols'] = [{ wch: 115 }]
    datos['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 19 }, { wch: 18 }, { wch: 18 }]
    resumen['!cols'] = [{ wch: 28 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(libro, instrucciones, 'Instrucciones')
    XLSX.utils.book_append_sheet(libro, datos, 'Datos')
    XLSX.utils.book_append_sheet(libro, resumen, 'Resumen')
    return XLSX.write(libro, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

export function leerPlanilla(archivo: Buffer, nombreArchivo: string): PlanillaResultado {
    const libro = XLSX.read(archivo, { type: 'buffer', cellFormula: true })
    const datos = libro.Sheets.Datos
    const resumen = libro.Sheets.Resumen
    if (!datos || !resumen) throw new Error('El archivo debe conservar las hojas Datos y Resumen')
    const origenIntacto = PLANILLA_FILAS.every((fila, i) => fila.every((valor, columna) => datos[`${'ABCD'[columna]}${i + 2}`]?.v === valor))
    const celda = (hoja: XLSX.WorkSheet, direccion: string): CeldaPlanilla => {
        const valor = hoja[direccion]?.v
        return { valor: typeof valor === 'number' || typeof valor === 'string' ? valor : null, formula: typeof hoja[direccion]?.f === 'string' ? hoja[direccion].f : null }
    }
    return {
        origenIntacto,
        totales: PLANILLA_FILAS.map((_, i) => celda(datos, `E${i + 2}`)),
        resumen: [2, 3, 4].map(i => celda(resumen, `B${i}`)),
        nombreArchivo: nombreArchivo.replace(/[^\w. -]/g, '').slice(0, 100) || 'planilla.xlsx',
    }
}
