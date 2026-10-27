import assert from 'node:assert/strict'
import test from 'node:test'
import {
    crearHtmlCaratulaLegajo,
    crearHtmlCaratulasLegajo,
    escaparHtmlCaratula,
    formatearFechaIngresoCaratula,
} from '../../components/empleados/imprimirCaratulaLegajo'

test('formatea la fecha civil de ingreso sin desplazar el día', () => {
    assert.equal(formatearFechaIngresoCaratula('2026-10-20T00:00:00.000Z'), '20/10/2026')
    assert.equal(formatearFechaIngresoCaratula(null), 'Sin registrar')
})

test('genera una página A4 independiente por cada empleado seleccionado', () => {
    const html = crearHtmlCaratulasLegajo([
        { id: 'emp-1', nombre: 'Ana', apellido: 'Zárate', activo: true },
        { id: 'emp-2', nombre: 'Luis', apellido: 'Acosta', activo: false },
    ], 'logo', 'marca')

    assert.equal((html.match(/<main class="hoja">/g) || []).length, 2)
    assert.match(html, /estado activo">ACTIVO/)
    assert.match(html, /estado inactivo">INACTIVO/)
    assert.match(html, /break-after: page/)
    assert.ok(html.indexOf('Acosta, Luis') < html.indexOf('Zárate, Ana'))
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

    assert.match(html, /Pérez, Ana &lt;Admin&gt;/)
    assert.match(html, /20\/10\/2026/)
    assert.match(html, /8 horas/)
    assert.match(html, /CARÁTULA DE LEGAJO/)
    assert.doesNotMatch(html, /Ana <Admin>/)
})
