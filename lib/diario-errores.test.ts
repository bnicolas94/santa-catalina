import assert from 'node:assert/strict'
import test from 'node:test'
import { diarioCSV, estadoSolucion, fechaValida, filtrosDiario, resumirIncidentes, validarArea, validarRegistro } from './diario-errores'
import { canAccessPath } from './access-control'

const ejemplo = { fecha: '2026-09-22', areaId: 'atencion', error: ' No se agendó el pedido en Excel ', responsable: ' Karen ', solucion: ' Se ofreció llevar el paquete ' }

test('normaliza los campos libres y permite completar la solución más adelante', () => {
    assert.deepEqual(validarRegistro(ejemplo), { ...ejemplo, error: ejemplo.error.trim(), responsable: 'Karen', solucion: ejemplo.solucion.trim() })
    assert.equal(validarRegistro({ ...ejemplo, solucion: '' }).solucion, '')
    for (const campo of ['fecha', 'areaId', 'error', 'responsable']) assert.throws(() => validarRegistro({ ...ejemplo, [campo]: ' ' }))
    assert.throws(() => validarRegistro(null))
    assert.throws(() => validarRegistro({ ...ejemplo, responsable: 12 }))
    assert.throws(() => validarRegistro({ ...ejemplo, error: 'a'.repeat(4001) }))
})

test('el check confirma la resolución independientemente del texto de solución', () => {
    assert.equal(validarRegistro({ ...ejemplo, solucionado: true, solucion: '' }).solucionado, true)
    assert.equal(validarRegistro({ ...ejemplo, solucionado: false }).solucionado, false)
    for (const value of ['true', 'false', 1, 0, null, {}]) assert.throws(() => validarRegistro({ ...ejemplo, solucionado: value }))
    // Una pestaña antigua que omite el check no debe sobrescribir el estado al editar.
    assert.equal(Object.hasOwn(validarRegistro(ejemplo), 'solucionado'), false)
    assert.equal(estadoSolucion(true), 'Solucionado')
    assert.equal(estadoSolucion(false), 'No solucionado')
    assert.equal(estadoSolucion(null), 'Sin confirmar')
})

test('el resumen cuenta todos los incidentes agregados y separa los históricos sin confirmar', () => {
    assert.deepEqual(resumirIncidentes([
        { solucionado: true, _count: { _all: 31 } },
        { solucionado: false, _count: { _all: 22 } },
        { solucionado: null, _count: { _all: 7 } },
    ]), { total: 60, solucionados: 31, noSolucionados: 22, sinConfirmar: 7 })
    assert.deepEqual(resumirIncidentes([]), { total: 0, solucionados: 0, noSolucionados: 0, sinConfirmar: 0 })
    assert.deepEqual(resumirIncidentes([{ solucionado: false, _count: { _all: 4 } }]), { total: 4, solucionados: 0, noSolucionados: 4, sinConfirmar: 0 })
})

test('el CSV informa el estado explícito y conserva la incertidumbre histórica', () => {
    const registros = [true, false, null].map(solucionado => ({ ...ejemplo, solucionado, area: { nombre: 'Atención' }, creadoPorNombre: 'Ana' }))
    const csv = diarioCSV(registros).split('\r\n')
    assert.ok(csv[0].includes('"Estado de solución"'))
    assert.ok(csv[1].includes('"Solucionado"'))
    assert.ok(csv[2].includes('"No solucionado"'))
    assert.ok(csv[3].includes('"Sin confirmar"'))
})

test('conserva el día local y rechaza fechas inexistentes o rangos invertidos', () => {
    assert.equal(fechaValida('2024-02-29'), '2024-02-29')
    for (const fecha of ['2026-02-29', '2026-04-31', '22/09/2026', '2026-09-22T00:00:00Z']) assert.throws(() => fechaValida(fecha))
    assert.throws(() => filtrosDiario(new URLSearchParams({ desde: '2026-09-23', hasta: '2026-09-22' })))
    assert.deepEqual(filtrosDiario(new URLSearchParams({ desde: '2026-09-22', hasta: '2026-09-22', areaId: 'atencion' })), { fecha: { gte: '2026-09-22', lte: '2026-09-22' }, areaId: 'atencion' })
})

test('evita áreas duplicadas por acentos, mayúsculas o espacios', () => {
    assert.equal(validarArea({ nombre: ' Atención  al cliente ' }).clave, validarArea({ nombre: 'ATENCION AL CLIENTE' }).clave)
    assert.equal(validarArea({ nombre: 'Producción', activa: false }).activa, false)
    assert.throws(() => validarArea({ nombre: ' ' }))
    assert.throws(() => validarArea({ nombre: 'Producción', activa: 'false' }))
})

test('el reporte conserva comillas y saltos de línea y neutraliza fórmulas', () => {
    const csv = diarioCSV([{ ...ejemplo, error: 'Error "pedido"\nsegunda línea', responsable: '=1+1', solucion: '\t@SUM(1)', area: { nombre: 'Atención' }, creadoPorNombre: 'Ana' }])
    assert.ok(csv.startsWith('\uFEFF'))
    assert.ok(csv.includes('"Error ""pedido""\nsegunda línea"'))
    assert.ok(csv.includes('"\'=1+1"'))
    assert.ok(csv.includes('"\'\t@SUM(1)"'))
})

test('página, registros, áreas y reportes exigen el permiso propio del diario', () => {
    for (const path of ['/diario-errores', '/api/diario-errores', '/api/diario-errores/areas', '/api/diario-errores/reporte']) {
        assert.equal(canAccessPath(path, { rol: 'ADMIN' }), true)
        assert.equal(canAccessPath(path, { permisos: { permisoDiarioErrores: true } }), true)
        assert.equal(canAccessPath(path, { permisos: { permisoReportes: true } }), false)
        assert.equal(canAccessPath(path, { rol: 'OPERARIO', ubicacionTipo: 'LOCAL' }), false)
        assert.equal(canAccessPath(path, {}), false)
    }
})
