import assert from 'node:assert/strict'
import test from 'node:test'

import { jornalDiarioEfectivo } from './jornal'

test('obtiene el jornal diario desde la configuración individual', () => {
    assert.equal(jornalDiarioEfectivo({ jornal: 71_280, cicloPago: 'DIARIO' }), 71_280)
    assert.equal(jornalDiarioEfectivo({ jornal: 360_000, cicloPago: 'SEMANAL' }), 60_000)
})

test('usa el tipo de empleado y luego el sueldo mensual como respaldo', () => {
    assert.equal(jornalDiarioEfectivo({
        jornal: 0,
        sueldoBaseMensual: 0,
        rolRel: { jornal: 71_280, cicloPago: 'DIARIO' },
    }), 71_280)
    assert.equal(jornalDiarioEfectivo({ sueldoBaseMensual: 900_000 }), 30_000)
})
