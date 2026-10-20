import assert from 'node:assert/strict'
import test from 'node:test'
import {
    crearHtmlCaratulaLegajo,
    escaparHtmlCaratula,
    formatearFechaIngresoCaratula,
} from '../../components/empleados/imprimirCaratulaLegajo'

test('formatea la fecha civil de ingreso sin desplazar el día', () => {
    assert.equal(formatearFechaIngresoCaratula('2026-10-20T00:00:00.000Z'), '20/10/2026')
    assert.equal(formatearFechaIngresoCaratula(null), 'Sin registrar')
})

test('escapa los datos del empleado antes de incorporarlos a la impresión', () => {
    assert.equal(escaparHtmlCaratula('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;')
    const html = crearHtmlCaratulaLegajo({
        id: 'emp-1',
        nombre: 'Ana <Admin>',
        apellido: 'Pérez',
        dni: '12.345.678',
        fechaIngreso: '2026-10-20T00:00:00.000Z',
        rol: 'PRODUCCION',
        activo: true,
        horasTrabajoDiarias: 8,
        ubicacion: { nombre: 'Fábrica' },
    }, 'data:image/png;base64,logo', 'data:image/png;base64,marca')

    assert.match(html, /Ana &lt;Admin&gt; Pérez/)
    assert.match(html, /20\/10\/2026/)
    assert.match(html, /8 horas/)
    assert.match(html, /CARÁTULA DE LEGAJO/)
    assert.doesNotMatch(html, /Ana <Admin>/)
})
