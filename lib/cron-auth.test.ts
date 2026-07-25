import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeCronRequest } from './cron-auth'

test('cron falla cerrado cuando CRON_SECRET no está configurado', () => {
    const previousSecret = process.env.CRON_SECRET
    delete process.env.CRON_SECRET

    try {
        const result = authorizeCronRequest(new Request('https://example.com/api/cron/test'))
        assert.deepEqual(result, {
            authorized: false,
            status: 503,
            error: 'El servicio de cron no está configurado',
        })
    } finally {
        if (previousSecret !== undefined) process.env.CRON_SECRET = previousSecret
    }
})

test('cron sólo acepta el secreto mediante Bearer', () => {
    const previousSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'un-secreto-de-prueba'

    try {
        const queryRequest = new Request('https://example.com/api/cron/test?secret=un-secreto-de-prueba')
        assert.equal(authorizeCronRequest(queryRequest).authorized, false)

        const bearerRequest = new Request('https://example.com/api/cron/test', {
            headers: { Authorization: 'Bearer un-secreto-de-prueba' },
        })
        assert.deepEqual(authorizeCronRequest(bearerRequest), { authorized: true })
    } finally {
        if (previousSecret === undefined) delete process.env.CRON_SECRET
        else process.env.CRON_SECRET = previousSecret
    }
})
