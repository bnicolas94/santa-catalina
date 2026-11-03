import { createHash, randomBytes } from 'node:crypto'

export function tokenNuevo() { return randomBytes(32).toString('hex') }
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }
export function tokenValido(token: string) { return /^[a-f0-9]{64}$/.test(token) }
