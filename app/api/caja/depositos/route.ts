import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { exigirAccesoCaja } from '@/lib/services/cajas-catalogo.service'
import { leerConfigDepositos } from '@/lib/caja/configDepositos'
import { prisma } from '@/lib/prisma'
import { CajaService } from '@/lib/services/caja.service'

const personaSelect = { id: true, nombre: true, apellido: true }

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const user = session.user as any
        const esAdmin = user?.rol === 'ADMIN'
        const permisos = user?.permisos || {}
        if (!esAdmin && !permisos.permisoCaja && user.ubicacionTipo !== 'LOCAL') {
            return NextResponse.json({ error: 'No tienes permiso para ver depósitos' }, { status: 403 })
        }

        const depositos = await (prisma as any).depositoCaja.findMany({
            where: {
                estado: 'pendiente',
                ...(!esAdmin && { declaradoPorId: user.id }),
            },
            orderBy: { fecha: 'asc' },
            take: 100,
            include: {
                declaradoPor: { select: personaSelect },
                validadoPor: { select: personaSelect },
            },
        })

        return NextResponse.json(depositos)
    } catch (error) {
        console.error('Error obteniendo depósitos:', error)
        return NextResponse.json({ error: 'Error al cargar depósitos' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const user = session.user as any
        const esAdmin = user?.rol === 'ADMIN'
        const permisos = user?.permisos || {}
        if (!esAdmin && !permisos.permisoCaja && user.ubicacionTipo !== 'LOCAL') {
            return NextResponse.json({ error: 'No tienes permiso para registrar depósitos' }, { status: 403 })
        }
        if (!user?.id) return NextResponse.json({ error: 'Usuario no identificado' }, { status: 400 })

        const body = await req.json()
        const ubicacionTipo = String(user?.ubicacionTipo || 'LOCAL').toUpperCase()
        const config = await leerConfigDepositos()
        const configUbicacion = config[user.ubicacionId || '']
        if (!esAdmin && (!configUbicacion || !configUbicacion.habilitarDeposito)) {
            return NextResponse.json({ error: 'Los depósitos no están habilitados para tu ubicación' }, { status: 403 })
        }

        const cajaOrigen = esAdmin ? body.cajaOrigen : configUbicacion.cajaDepositoId
        const concepto = esAdmin ? body.concepto : configUbicacion.conceptoDeposito
        try { await exigirAccesoCaja(user, cajaOrigen) }
        catch { return NextResponse.json({ error: 'La caja no pertenece a tu sede o está inactiva.' }, { status: 403 }) }

        const deposito = await CajaService.registrarDeposito({
            ubicacionCajaId: esAdmin ? undefined : user.ubicacionId || '__sin_sede__',
            montoDeclarado: body.montoDeclarado,
            cajaOrigen,
            concepto,
            declaradoPorId: user.id,
            ubicacionTipo,
            fecha: body.fecha,
        })
        return NextResponse.json(deposito, { status: 201 })
    } catch (error) {
        console.error('Error registrando depósito:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al registrar depósito' }, { status: 400 })
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as any
        if (user?.rol !== 'ADMIN') return NextResponse.json({ error: 'Solo un administrador puede validar depósitos' }, { status: 403 })
        if (!user?.id) return NextResponse.json({ error: 'Administrador no identificado' }, { status: 400 })

        const body = await req.json()
        if (Number(body.montoReal) > 0) await exigirAccesoCaja(user, body.cajaDestino)
        const deposito = await CajaService.validarDeposito({
            depositoId: body.id,
            montoReal: body.montoReal,
            cajaDestino: body.cajaDestino,
            observaciones: body.observaciones,
            validadoPorId: user.id,
            fecha: body.fecha,
        })
        return NextResponse.json(deposito)
    } catch (error) {
        console.error('Error validando depósito:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Error al validar depósito' }, { status: 400 })
    }
}
