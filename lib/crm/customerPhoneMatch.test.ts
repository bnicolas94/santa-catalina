import assert from 'node:assert/strict'
import test from 'node:test'
import { argentineNationalNumber, matchCustomersByPhone } from './customerPhoneMatch'

const customer = {
    id: 'cliente-1',
    nombreComercial: 'Almacén Norte',
    contactoNombre: 'Ana',
    contactoTelefono: '+54 9 11 4321-9876',
    direccion: 'Belgrano 123',
    zona: 'Norte',
    localidad: 'CABA',
}

test('normaliza el formato internacional argentino a diez dígitos nacionales', () => {
    assert.equal(argentineNationalNumber('+54 9 11 4321-9876'), '1143219876')
    assert.equal(argentineNationalNumber('11 4321 9876'), '1143219876')
})

test('prioriza una coincidencia telefónica exacta', () => {
    const matches = matchCustomersByPhone('+54 9 11 4321-9876', [customer])
    assert.equal(matches.length, 1)
    assert.equal(matches[0].matchQuality, 'EXACT')
})

test('acepta la misma línea con formato nacional sin arriesgar sufijos cortos', () => {
    const matches = matchCustomersByPhone('+54 9 11 4321-9876', [
        { ...customer, contactoTelefono: '11 4321-9876' },
    ])
    assert.equal(matches.length, 1)
    assert.equal(matches[0].matchQuality, 'NATIONAL')
    assert.deepEqual(matchCustomersByPhone('12345', [customer]), [])
})

test('conserva todas las coincidencias para que el agente resuelva duplicados', () => {
    const matches = matchCustomersByPhone('+54 9 11 4321-9876', [
        customer,
        { ...customer, id: 'cliente-2', nombreComercial: 'Almacén Sur' },
    ])
    assert.deepEqual(matches.map(item => item.id), ['cliente-1', 'cliente-2'])
})
