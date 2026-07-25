import assert from 'node:assert/strict'
import test from 'node:test'

import { escaparHtml, formatearFechaCivil, textoEstadoAsistencia } from '../../components/analytics/legajo.utils'

test('formatea fechas y estados del legajo de manera consistente', () => {
    assert.equal(formatearFechaCivil('2026-07-25T03:00:00.000Z'), '25/07/2026')
    assert.equal(textoEstadoAsistencia('ENFERMEDAD'), 'Enfermedad')
    assert.equal(textoEstadoAsistencia('DESCONOCIDO'), 'DESCONOCIDO')
})

test('escapa datos ingresados por usuarios antes de imprimir sanciones', () => {
    assert.equal(escaparHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
})
