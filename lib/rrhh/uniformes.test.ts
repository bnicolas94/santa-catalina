import assert from 'node:assert/strict'
import test from 'node:test'
import { ErrorUniformes, faltantesConstanciaUniformes, validarCantidadEntera, validarCuitUniformes, validarDetallesUniforme, validarFechaEntrega, validarTalle } from './uniformes'

test('la entrega exige prendas con talles y cantidades válidas', () => {
    assert.deepEqual(validarDetallesUniforme([
        { prenda: 'REMERA', talle: ' m ', cantidad: 2 },
        { prenda: 'BUZO', talle: 'XL', cantidad: 1 },
    ]), [
        { prenda: 'REMERA', talle: 'M', cantidad: 2 },
        { prenda: 'BUZO', talle: 'XL', cantidad: 1 },
    ])
    assert.throws(() => validarDetallesUniforme([{ prenda: 'REMERA', talle: 'M', cantidad: -1 }]), ErrorUniformes)
    assert.throws(() => validarDetallesUniforme([{ prenda: 'BUZO', talle: 'M', cantidad: 1.5 }]), ErrorUniformes)
    assert.throws(() => validarDetallesUniforme([{ prenda: 'PANTALON', talle: 'M', cantidad: 1 }]), ErrorUniformes)
    assert.throws(() => validarDetallesUniforme([]), ErrorUniformes)
})

test('no permite repetir la misma prenda y talle con distinta escritura', () => {
    assert.throws(() => validarDetallesUniforme([
        { prenda: 'REMERA', talle: 'm', cantidad: 1 },
        { prenda: 'REMERA', talle: ' M ', cantidad: 2 },
    ]), ErrorUniformes)
})

test('la fecha de entrega es un día civil válido y la cantidad es entera', () => {
    assert.equal(validarFechaEntrega('2026-09-23'), '2026-09-23')
    assert.throws(() => validarFechaEntrega('2026-02-30'), ErrorUniformes)
    assert.throws(() => validarFechaEntrega('2026-09-23T00:00:00Z'), ErrorUniformes)
    assert.equal(validarTalle(' xxl '), 'XXL')
    assert.throws(() => validarCantidadEntera(0), ErrorUniformes)
    assert.throws(() => validarCantidadEntera(1.2), ErrorUniformes)
})

test('la constancia exige todos los datos del Anexo I antes de imprimirse', () => {
    const completa = {
        empleador: { razonSocial: 'Empresa de prueba', cuit: '30123456789' },
        establecimiento: { direccion: 'Calle 1', localidad: 'La Plata', codigoPostal: '1900', provincia: 'Buenos Aires' },
        dni: '12345678', puesto: 'Operario', eppNecesarios: 'Según evaluación de riesgos',
        filas: [{ tipoModelo: 'Modelo A', marca: 'Marca A', certificado: false }],
    }
    assert.deepEqual(faltantesConstanciaUniformes(completa), [])
    assert.deepEqual(faltantesConstanciaUniformes({ ...completa, establecimiento: null, filas: [{ ...completa.filas[0], certificado: null }] }), [
        'Domicilio, localidad, CP y provincia de la sede del trabajador',
        'Modelo, marca y certificación de todas las prendas entregadas',
    ])
    assert.equal(validarCuitUniformes('30-12345678-9'), '30123456789')
    assert.throws(() => validarCuitUniformes('123'), ErrorUniformes)
})
