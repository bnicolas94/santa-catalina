import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { validateMercadoPagoSignature } from './mercadopago-webhook'

test('valida el manifiesto oficial de Mercado Pago con separador final', () => {
    const previousSecret = process.env.MP_WEBHOOK_SECRET
    process.env.MP_WEBHOOK_SECRET = 'secreto-de-prueba'

    try {
        const dataId = 'ABC123'
        const requestId = 'request-456'
        const timestamp = '1704908010'
        const manifest = `id:abc123;request-id:${requestId};ts:${timestamp};`
        const digest = createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
            .update(manifest)
            .digest('hex')
        const request = new Request(`https://example.com/webhook?data.id=${dataId}`, {
            headers: {
                'x-request-id': requestId,
                'x-signature': `ts=${timestamp},v1=${digest}`,
            },
        })

        assert.deepEqual(validateMercadoPagoSignature(request, dataId), { valid: true })
    } finally {
        if (previousSecret === undefined) delete process.env.MP_WEBHOOK_SECRET
        else process.env.MP_WEBHOOK_SECRET = previousSecret
    }
})

test('rechaza firmas incorrectas o incompletas', () => {
    const previousSecret = process.env.MP_WEBHOOK_SECRET
    process.env.MP_WEBHOOK_SECRET = 'secreto-de-prueba'

    try {
        const invalidRequest = new Request('https://example.com/webhook', {
            headers: {
                'x-request-id': 'request-456',
                'x-signature': 'ts=1704908010,v1=incorrecta',
            },
        })
        assert.equal(validateMercadoPagoSignature(invalidRequest, '123').valid, false)
        assert.equal(
            validateMercadoPagoSignature(new Request('https://example.com/webhook'), '123').valid,
            false
        )
    } finally {
        if (previousSecret === undefined) delete process.env.MP_WEBHOOK_SECRET
        else process.env.MP_WEBHOOK_SECRET = previousSecret
    }
})
