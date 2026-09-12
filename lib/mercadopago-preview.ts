import { createHmac, timingSafeEqual } from 'node:crypto'
import type { EgresoReporteMP } from './mercadopago-reporte'

export interface PreviewMP { usuarioId: string; cuentaId: string; hash: string; vence: number; filas: EgresoReporteMP[] }
function secreto() {
    const valor = process.env.NEXTAUTH_SECRET
    if (!valor) throw new Error('No se puede firmar la vista previa: falta configuración de sesión.')
    return valor
}
export function firmarPreviewMP(datos: PreviewMP): string {
    const payload = Buffer.from(JSON.stringify(datos)).toString('base64url')
    return `${payload}.${createHmac('sha256', secreto()).update(`mp-reporte:${payload}`).digest('base64url')}`
}
export function verificarPreviewMP(token: string, usuarioId: string, cuentaId: string): PreviewMP {
    if (typeof token !== 'string' || token.length > 30000) throw new Error('Vista previa inválida.')
    const partes = token.split('.')
    if (partes.length !== 2) throw new Error('Vista previa inválida.')
    const firma = createHmac('sha256', secreto()).update(`mp-reporte:${partes[0]}`).digest('base64url')
    if (firma.length !== partes[1].length || !timingSafeEqual(Buffer.from(firma), Buffer.from(partes[1]))) throw new Error('La vista previa fue modificada.')
    const datos = JSON.parse(Buffer.from(partes[0], 'base64url').toString()) as PreviewMP
    if (datos.usuarioId !== usuarioId || datos.cuentaId !== cuentaId || datos.vence < Date.now()) throw new Error('La vista previa venció o pertenece a otra sesión/cuenta. Generala nuevamente.')
    return datos
}
