import assert from 'node:assert/strict'
import test from 'node:test'

import { esMovimientoGestionadoPorRRHH, validarMotivoReasignacionCaja } from './movimientosProtegidos'

test('protege todos los vínculos contables cuyo origen es RRHH', () => {
    assert.equal(esMovimientoGestionadoPorRRHH({ liquidacionSueldoId: 'liq' }), true)
    assert.equal(esMovimientoGestionadoPorRRHH({ liquidacionFinalId: 'final' }), true)
    assert.equal(esMovimientoGestionadoPorRRHH({ prestamoId: 'prestamo' }), true)
    assert.equal(esMovimientoGestionadoPorRRHH({ cuotaPrestamoId: 'cuota' }), true)
    assert.equal(esMovimientoGestionadoPorRRHH({ pagoCierreMensualId: 'pago' }), true)
    assert.equal(esMovimientoGestionadoPorRRHH({ concepto: 'LIQUIDACION_FINAL' }), true)
    assert.equal(esMovimientoGestionadoPorRRHH({}), false)
})

test('la reasignación exige un motivo auditable', () => {
    assert.equal(validarMotivoReasignacionCaja('Caja seleccionada por error'), 'Caja seleccionada por error')
    assert.throws(() => validarMotivoReasignacionCaja('error'), /entre 10 y 500/)
})
