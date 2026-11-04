import assert from 'node:assert/strict'
import test from 'node:test'
import { estadoInvitacion, invitacionAccesible, validarCandidato, validarDemo, vigenciaDias } from './reglas'

test('la invitación revocada o vencida no da acceso aunque se haya iniciado', () => {
    const ahora = new Date('2026-11-04T12:00:00Z')
    const inv = { venceAt: new Date('2026-11-05T12:00:00Z'), revocadaAt: null, intento: { inicioAt: ahora }, candidato: { archivadoAt: null } }
    assert.equal(estadoInvitacion(inv, ahora), 'UTILIZADA')
    assert.equal(invitacionAccesible(inv, ahora), true)
    assert.equal(invitacionAccesible({ ...inv, revocadaAt: ahora }, ahora), false)
    assert.equal(invitacionAccesible({ ...inv, venceAt: ahora }, ahora), false)
    assert.equal(invitacionAccesible({ ...inv, candidato: { archivadoAt: ahora } }, ahora), false)
})

test('validaciones y vigencia limitan los datos', () => {
    assert.equal(vigenciaDias('8'), 8)
    assert.equal(vigenciaDias('0'), 7)
    assert.throws(() => validarCandidato({ nombre: 'A', apellido: 'B', email: 'mal' }))
    assert.equal(validarCandidato({ nombre: ' Ana ', apellido: ' Pérez ' }).nombre, 'Ana')
    assert.throws(() => validarDemo({ texto: 'x'.repeat(2001) }))
})
