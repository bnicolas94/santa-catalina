import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'

export async function GET(request: Request) {
    const authorization = authorizeCronRequest(request)
    if (!authorization.authorized) {
        return NextResponse.json(
            { error: authorization.error },
            { status: authorization.status }
        )
    }

    try {
        await prisma.$queryRaw`SELECT 1`

        return NextResponse.json({
            status: 'ok',
            database: 'reachable',
            timestamp: new Date().toISOString(),
        })
    } catch (error: unknown) {
        console.error('System health check failed:', error)
        return NextResponse.json(
            { status: 'error', database: 'unreachable' },
            { status: 503 }
        )
    }
}
