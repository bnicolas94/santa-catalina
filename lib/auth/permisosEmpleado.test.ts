import assert from 'node:assert/strict'
import test from 'node:test'

import { aplicarPermisosIndividuales, normalizarPermisosIndividuales } from './permisosEmpleado'
import { aplicarAccesosOperativos } from './permisosRol'

test('los permisos individuales permiten y deniegan sobre el rol', () => {
    const efectivos = aplicarPermisosIndividuales(
        {
            permisoDashboard: false,
            permisoStock: true,
            permisoCaja: false,
            permisoPersonal: false,
            permisoProduccion: true,
            permisoPantallaProduccion: false,
            permisoCostos: false,
            permisoCompras: false,
            permisoClientes: false,
            permisoPedidos: false,
            permisoLogistica: false,
            permisoFlota: false,
            permisoReportes: false,
            permisoDiarioErrores: false,
            permisoAtencion: false,
            permisoAtencionAdmin: false,
        },
        [
            { clave: 'permisoStock', permitido: false },
            { clave: 'permisoFlota', permitido: true },
        ],
    )

    assert.equal(efectivos?.permisoStock, false)
    assert.equal(efectivos?.permisoProduccion, true)
    assert.equal(efectivos?.permisoFlota, true)
})

test('sin excepciones conserva exactamente el mapa del rol', () => {
    const rol = { permisoStock: true } as Parameters<typeof aplicarPermisosIndividuales>[0]
    assert.equal(aplicarPermisosIndividuales(rol, []), rol)
})

test('rechaza claves desconocidas y permisos repetidos', () => {
    assert.throws(() => normalizarPermisosIndividuales([{ clave: 'permisoInventado', permitido: true }]))
    assert.throws(() => normalizarPermisosIndividuales([
        { clave: 'permisoCaja', permitido: true },
        { clave: 'permisoCaja', permitido: false },
    ]))
})

test('una regla operativa obligatoria prevalece sobre una denegación individual', () => {
    const conExcepcion = aplicarPermisosIndividuales(null, [{ clave: 'permisoCaja', permitido: false }])
    const local = aplicarAccesosOperativos(conExcepcion, 'LOCAL')
    assert.equal(local?.permisoCaja, true)
})
