import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessPath } from '../access-control'
import { calcularDisponibilidad, calcularProyeccionDias, calcularStockDesdeFoto, leerDemandaPaqTotales, leerDemandasPaqTotales, turnosVisibles } from './pantalla-stock'

function filas() {
    const encabezados = Array(18).fill('')
    const turnos = Array(18).fill('')
    for (const [columna, nombre] of [[2, '48 JYQ'], [6, '24 JYQ'], [10, '48 CLA'], [14, '48 ESP']] as const) {
        encabezados[columna] = nombre
        turnos[columna] = 'Mañana'
        turnos[columna + 1] = 'Siesta'
        turnos[columna + 2] = 'Tarde'
    }
    const pedido = Array(18).fill('')
    pedido[1] = 46289 // 24/09/2026 en formato Excel
    ;[13, 10, 10, 11, 8, 11, 7, 7, 4, 2, 1, 2].forEach((n, i) => {
        const base = [2, 6, 10, 14][Math.floor(i / 3)]
        pedido[base + i % 3] = n
    })
    return [encabezados, turnos, pedido]
}

test('lee los cuatro productos por turno de Paq. Totales y calcula paquetes libres', () => {
    const demanda = leerDemandaPaqTotales(filas(), '2026-09-24')
    assert.equal(demanda.Mañana['JQ:48'], 13)
    assert.equal(demanda.Siesta['JQ:48'], 10)
    assert.equal(demanda.Tarde['ESP:48'], 2)
    const columnas = calcularDisponibilidad(
        { 'JQ:48': 64, 'JQ:24': 45, 'CLA:48': 25, 'ESP:48': 15 },
        { 'JQ:48': 6, 'JQ:24': 0, 'CLA:48': 3, 'ESP:48': 0 },
        demanda,
    )
    assert.equal(columnas[0].libre, 37)
    assert.equal(columnas[2].libre, 10)
})

test('encadena el stock libre de cada día futuro sin inventar producción', () => {
    const matriz = filas()
    const pasadoManana = Array(18).fill('')
    pasadoManana[1] = 46291
    pasadoManana[2] = 3
    const manana = Array(18).fill('')
    manana[1] = 46290
    manana[2] = 5
    manana[3] = 2
    manana[4] = 1
    matriz.push(pasadoManana, manana)

    const demandas = leerDemandasPaqTotales(matriz, '2026-09-24')
    assert.deepEqual(demandas.map(dia => dia.fecha), ['2026-09-24', '2026-09-25', '2026-09-26'])
    const dias = calcularProyeccionDias({ 'JQ:48': 64 }, { 'JQ:48': 6 }, demandas)
    assert.equal(dias[0].columnas[0].libre, 37)
    assert.equal(dias[1].columnas[0].stockInicial, 37)
    assert.equal(dias[1].columnas[0].produccion, 0)
    assert.equal(dias[1].columnas[0].libre, 29)
    assert.equal(dias[2].columnas[0].stockInicial, 29)
    assert.equal(dias[2].columnas[0].libre, 26)
})

test('oculta cada turno a las 13, 16 y 21 sin alterar el total reservado', () => {
    assert.deepEqual(turnosVisibles(9 * 60), ['Mañana', 'Siesta', 'Tarde'])
    assert.deepEqual(turnosVisibles(13 * 60 - 1), ['Mañana', 'Siesta', 'Tarde'])
    assert.deepEqual(turnosVisibles(13 * 60), ['Siesta', 'Tarde'])
    assert.deepEqual(turnosVisibles(16 * 60 - 1), ['Siesta', 'Tarde'])
    assert.deepEqual(turnosVisibles(16 * 60), ['Tarde'])
    assert.deepEqual(turnosVisibles(21 * 60 - 1), ['Tarde'])
    assert.deepEqual(turnosVisibles(21 * 60), [])
})

test('cuenta los lotes desde las 9 y usa la corrección manual como nueva base', () => {
    const { inicial, producido, ultimoAjuste } = calcularStockDesdeFoto(
        { tomadoAt: '2026-09-24T18:06:59.096Z', cantidades: { jq48: 756, cla48: 404 } },
        [
            { presentacionId: 'jq48', tipo: 'produccion', signo: 'entrada', cantidad: 21, fecha: new Date('2026-09-24T16:00:00Z') },
            { presentacionId: 'jq48', tipo: 'ajuste', signo: 'salida', cantidad: 710, fecha: new Date('2026-09-24T18:08:00Z') },
            { presentacionId: 'cla48', tipo: 'produccion', signo: 'entrada', cantidad: 28, fecha: new Date('2026-09-24T16:00:00Z') },
            { presentacionId: 'cla48', tipo: 'ajuste', signo: 'salida', cantidad: 379, fecha: new Date('2026-09-24T18:08:00Z') },
        ],
    )
    assert.equal(inicial.jq48, 46)
    assert.equal(producido.jq48, 21)
    assert.equal(inicial.cla48, 25)
    assert.equal(producido.cla48, 28)
    assert.equal(ultimoAjuste?.toISOString(), '2026-09-24T18:08:00.000Z')
    const demanda = leerDemandaPaqTotales(filas(), '2026-09-24')
    const [columna] = calcularDisponibilidad({ 'JQ:48': inicial.jq48 }, { 'JQ:48': producido.jq48 }, demanda)
    assert.equal(columna.stockInicial, 46)
    assert.equal(columna.produccion, 21)
    assert.equal(columna.libre, 34)
})

test('si la foto se tomó tarde, descuenta de la base los lotes ya incluidos', () => {
    const { inicial, producido } = calcularStockDesdeFoto(
        { tomadoAt: '2026-09-24T18:00:00Z', cantidades: { jq48: 40 } },
        [
            { presentacionId: 'jq48', tipo: 'produccion', signo: 'entrada', cantidad: 10, fecha: new Date('2026-09-24T16:00:00Z') },
            { presentacionId: 'jq48', tipo: 'ajuste_produccion', signo: 'salida', cantidad: 2, fecha: new Date('2026-09-24T16:05:00Z') },
            { presentacionId: 'jq48', tipo: 'produccion', signo: 'entrada', cantidad: 5, fecha: new Date('2026-09-24T19:00:00Z') },
        ],
    )
    assert.equal(inicial.jq48, 32)
    assert.equal(producido.jq48, 13)
})

test('una columna movida o una fecha duplicada detiene el cálculo', () => {
    const matriz = filas()
    matriz[0][2] = '48 ESP'
    assert.throws(() => leerDemandaPaqTotales(matriz, '2026-09-24'), /encabezado/)
    const duplicado = filas()
    duplicado.push([...duplicado[2]])
    assert.throws(() => leerDemandaPaqTotales(duplicado, '2026-09-24'), /una sola fila/)
})

test('la pantalla y su API requieren el permiso propio de pantalla de stock', () => {
    for (const ruta of ['/produccion/pantalla', '/api/produccion/pantalla-stock']) {
        assert.equal(canAccessPath(ruta, { permisos: { permisoPantallaProduccion: true } }), true)
        assert.equal(canAccessPath(ruta, { permisos: { permisoProduccion: true, permisoPantallaProduccion: false } }), false)
        assert.equal(canAccessPath(ruta, { permisos: { permisoReportes: true } }), false)
    }
    assert.equal(canAccessPath('/produccion', { permisos: { permisoPantallaProduccion: true } }), false)
    assert.equal(canAccessPath('/api/produccion/planificacion', { permisos: { permisoPantallaProduccion: true } }), false)
})
