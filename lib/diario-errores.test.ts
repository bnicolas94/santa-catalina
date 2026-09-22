import assert from 'node:assert/strict'
import test from 'node:test'
import { diarioCSV, fechaValida, filtrosDiario, validarArea, validarRegistro } from './diario-errores'
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
