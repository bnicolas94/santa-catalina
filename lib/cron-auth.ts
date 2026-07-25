import { timingSafeEqual } from 'node:crypto'

export type CronAuthorizationResult =
    | { authorized: true }
    | { authorized: false; status: 401 | 503; error: string }

function secretsMatch(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received)
    const expectedBuffer = Buffer.from(expected)

    return receivedBuffer.length === expectedBuffer.length
        && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function authorizeCronRequest(request: Request): CronAuthorizationResult {
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
        return {
            authorized: false,
            status: 503,
            error: 'El servicio de cron no está configurado',
        }
    }

    const authorization = request.headers.get('authorization')
    const receivedSecret = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : ''

    if (!receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
        return { authorized: false, status: 401, error: 'No autorizado' }
    }

    return { authorized: true }
}
