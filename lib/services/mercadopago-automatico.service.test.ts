import assert from 'node:assert/strict'
import test from 'node:test'
import { avanzarReportesMP, nuevoEstadoMP, type EstadoAutomaticoMP } from './mercadopago-automatico.service'
import { leerReporteAutomaticoMP } from '@/lib/mercadopago-reporte'
import { encontrarReporteMP, solicitarReporteMP } from '@/lib/mercadopago-reportes-api'

const cabecera = 'SOURCE_ID;REAL_AMOUNT;TRANSACTION_DATE;TRANSACTION_TYPE'
const fecha = '2026-09-11T20:00:00Z'
const csv = `${cabecera}\n123;-11000;${fecha};SETTLEMENT\n124;-500;${fecha};SETTLEMENT`

test('el reporte automático admite cero y más de 30 egresos, y separa los eventos no soportados sin importar duplicados', () => {
    assert.deepEqual(leerReporteAutomaticoMP(cabecera).filas, [])
    assert.equal(leerReporteAutomaticoMP(`${cabecera}\n123;100;${fecha};SETTLEMENT`).filas.length, 0)
    assert.equal(leerReporteAutomaticoMP(`${cabecera}\n${Array.from({ length: 45 }, (_, i) => `${1000 + i};-100;${fecha};SETTLEMENT`).join('\n')}`).filas.length, 45)
    const resultado = leerReporteAutomaticoMP(`${csv}\n123;-11000;${fecha};SETTLEMENT\n125;-600;${fecha};WITHDRAWAL`)
    assert.deepEqual(resultado.filas.map(f => f.id), ['124'])
    assert.equal(resultado.incidencias.length, 2)
    assert.throws(() => leerReporteAutomaticoMP('SOURCE_ID\n123'), /columnas/)
    assert.throws(() => leerReporteAutomaticoMP(`${cabecera}\n123;incorrecto;${fecha};SETTLEMENT`), /Importe/)
})

test('solicita, espera sin duplicar solicitudes y retoma el lote después de reiniciar; los ambiguos no descuentan', async () => {
    let ahora = Date.parse('2026-09-12T20:00:00Z'); let disponible = false; let solicitudes = 0
    const registrados = new Set<string>(); let descuentos = 0
    let estado = nuevoEstadoMP(ahora)
    const deps = {
        ahora: () => ahora, verificar: async () => 'cuenta', encontrar: async () => disponible ? 'reporte.csv' : undefined,
        solicitar: async () => { solicitudes++ }, descargar: async () => ({ csv, ...leerReporteAutomaticoMP(csv) }),
        registrar: async (fila: { id: string }) => {
            if (fila.id === '124') return { creado: false, error: 'Posible carga manual' }
            if (registrados.has(fila.id)) return { creado: false }
            registrados.add(fila.id); descuentos++; return { creado: true }
        },
    }
    await avanzarReportesMP(estado, deps)
    assert.equal(solicitudes, 1); assert.equal(descuentos, 0)
    ahora += 5 * 60000; await avanzarReportesMP(estado, deps)
    assert.equal(solicitudes, 1)
    disponible = true; ahora += 5 * 60000
    await avanzarReportesMP(estado, deps)
    assert.equal(descuentos, 1); assert.equal(estado.trabajo?.indice, 1)
    estado = JSON.parse(JSON.stringify(estado)) as EstadoAutomaticoMP
    ahora += 15000; await avanzarReportesMP(estado, deps)
    assert.equal(estado.trabajo, undefined); assert.equal(estado.pendientes.length, 1)
    assert.equal(estado.incorporados, 1); assert.equal(descuentos, 1)
    assert.ok(estado.ultimaActualizacion)
    ahora += 15000; await avanzarReportesMP(estado, deps)
    assert.equal(descuentos, 1, 'el solapamiento de reportes no duplica un egreso')
})

test('no avanza el período ante errores de cuenta, descarga o registro; puede completar un reporte sin egresos', async () => {
    const ahora = Date.now(); const estado = nuevoEstadoMP(ahora); const hastaOriginal = estado.hasta
    const deps = {
        ahora: () => ahora, verificar: async () => 'cuenta', encontrar: async () => 'reporte.csv', solicitar: async () => {},
        descargar: async () => { throw new Error('HTTP 503') }, registrar: async () => ({ creado: false }),
    }
    await avanzarReportesMP(estado, deps)
    assert.equal(estado.hasta, hastaOriginal); assert.match(estado.error!, /503/)
    estado.proximoIntento = 0
    await avanzarReportesMP(estado, { ...deps, descargar: async () => ({ csv: cabecera, filas: [], incidencias: [] }) })
    assert.notEqual(estado.hasta, hastaOriginal); assert.equal(estado.error, undefined)
    estado.proximoIntento = 0
    await avanzarReportesMP(estado, { ...deps, verificar: async () => { throw new Error('Cuenta incorrecta') } })
    assert.match(estado.error!, /Cuenta incorrecta/)
})

test('rechaza HTTP 203, conserva la configuración y no selecciona reportes ajenos o de otro período', async t => {
    const previo = process.env.MP_ACCESS_TOKEN; process.env.MP_ACCESS_TOKEN = 'prueba'
    t.after(() => { if (previo === undefined) delete process.env.MP_ACCESS_TOKEN; else process.env.MP_ACCESS_TOKEN = previo })
    const trabajo = { desde: '2026-09-10T00:00:00.000Z', hasta: '2026-09-11T00:00:00.000Z' }
    let put: Record<string, unknown> | undefined
    t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init: RequestInit) => {
        const url = String(input)
        assert.equal(init.redirect, 'error')
        if (url.endsWith('/list')) return Response.json([
            { user_id: 'otra', begin_date: trabajo.desde, end_date: trabajo.hasta, file_name: 'ajeno.csv' },
            { user_id: 'cuenta', begin_date: trabajo.desde, end_date: trabajo.hasta, file_name: 'propio.csv' },
        ])
        if (url.endsWith('/config')) {
            if (init.method === 'PUT') { put = JSON.parse(String(init.body)); return Response.json({}) }
            return Response.json({ columns: [{ key: 'SOURCE_ID' }], display_timezone: 'GMT-04', frequency: { type: 'monthly', value: 1 } })
        }
        return new Response('{}', { status: 203 })
    })
    assert.equal(await encontrarReporteMP(trabajo, 'cuenta'), 'propio.csv')
    await assert.rejects(solicitarReporteMP(trabajo), /203/)
    assert.equal(put?.display_timezone, 'GMT-04')
    assert.deepEqual(put?.frequency, { type: 'monthly', value: 1 })
    assert.equal((put?.columns as unknown[]).length, 4)
})
