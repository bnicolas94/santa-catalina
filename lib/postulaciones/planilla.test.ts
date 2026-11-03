import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { PLANILLA_FILAS, metricasPlanilla } from './habilidades'
import { crearPlanilla, leerPlanilla } from './planilla'

test('la plantilla .xlsx se puede completar y leer con fórmulas y resumen', () => {
    const libro = XLSX.read(crearPlanilla(), { type: 'buffer' })
    assert.deepEqual(libro.SheetNames, ['Instrucciones', 'Datos', 'Resumen'])
    const totales = PLANILLA_FILAS.map(fila => fila[1] * fila[2])
    totales.forEach((valor, i) => { libro.Sheets.Datos[`E${i + 2}`] = { t: 'n', f: `B${i + 2}*C${i + 2}`, v: valor } })
    const resumen = [PLANILLA_FILAS.reduce((n, fila) => n + (fila[3] === 'Confirmado' ? fila[1] * fila[2] : 0), 0), 2, Math.max(...totales)]
    ;['SUMIF(Datos!D2:D9,"Confirmado",Datos!E2:E9)', 'COUNTIF(Datos!D2:D9,"Pendiente")', 'MAX(Datos!E2:E9)'].forEach((formula, i) => {
        libro.Sheets.Resumen[`B${i + 2}`] = { t: 'n', f: formula, v: resumen[i] }
    })
    const cargada = leerPlanilla(XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }), 'resuelta.xlsx')
    assert.deepEqual(metricasPlanilla(cargada), { origenIntacto: true, valoresCorrectos: 11, formulas: 11, celdas: 11 })
    libro.Sheets.Datos.B2.v = 99
    const alterada = leerPlanilla(XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }), 'alterada.xlsx')
    assert.equal(alterada.origenIntacto, false)
})
