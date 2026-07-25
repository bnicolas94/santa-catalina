import { createHmac, timingSafeEqual } from 'node:crypto'

export type MercadoPagoSignatureResult =
    | { valid: true }
    | { valid: false; status: 401 | 503; error: string }

function parseSignature(signature: string) {
    const parts = new Map<string, string>()

    for (const part of signature.split(',')) {
        const separatorIndex = part.indexOf('=')
        if (separatorIndex === -1) continue

        const key = part.slice(0, separatorIndex).trim()
        const value = part.slice(separatorIndex + 1).trim()
        if (key && value) parts.set(key, value)
    }

    return { timestamp: parts.get('ts'), digest: parts.get('v1') }
}

function digestsMatch(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received, 'utf8')
    const expectedBuffer = Buffer.from(expected, 'utf8')

    return receivedBuffer.length === expectedBuffer.length
        && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function validateMercadoPagoSignature(
    request: Request,
    dataId: string
): MercadoPagoSignatureResult {
    const secret = process.env.MP_WEBHOOK_SECRET
    if (!secret) {
        return { valid: false, status: 503, error: 'Webhook no configurado' }
    }

    const signature = request.headers.get('x-signature')
    const requestId = request.headers.get('x-request-id')
    if (!signature || !requestId || !dataId) {
        return { valid: false, status: 401, error: 'Firma de webhook ausente' }
    }

    const { timestamp, digest } = parseSignature(signature)
    if (!timestamp || !digest) {
        return { valid: false, status: 401, error: 'Firma de webhook inválida' }
    }

    // Mercado Pago exige minúsculas para identificadores alfanuméricos.
    const normalizedDataId = dataId.toLowerCase()
    const manifest = `id:${normalizedDataId};request-id:${requestId};ts:${timestamp};`
    const expectedDigest = createHmac('sha256', secret).update(manifest).digest('hex')

    if (!digestsMatch(digest, expectedDigest)) {
        return { valid: false, status: 401, error: 'Firma de webhook inválida' }
    }

    return { valid: true }
}
