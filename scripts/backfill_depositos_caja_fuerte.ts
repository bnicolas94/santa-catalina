import { Prisma } from '@prisma/client'

import { prisma } from '../lib/prisma'
import { CajaService } from '../lib/services/caja.service'

const aplicar = process.argv.includes('--apply')

async function main() {
    const pendientes = await prisma.depositoCaja.findMany({
        where: {
            estado: 'pendiente',
            cajaRecepcion: null,
            movimientoIngreso: { tipo: 'egreso' },
        },
        include: {
            movimientoIngreso: { select: { tipo: true } },
        },
        orderBy: { fecha: 'asc' },
    })

    console.log(`Depósitos pendientes para asociar: ${pendientes.length}`)
    for (const deposito of pendientes) {
        const origen = await prisma.saldoCaja.findUnique({ where: { tipo: deposito.cajaOrigen } })
        const recepcion = origen?.ubicacionId
            ? await prisma.saldoCaja.findFirst({
                where: { ubicacionId: origen.ubicacionId, activo: true, recibeDepositos: true },
            })
            : null

        console.log(JSON.stringify({
            depositoId: deposito.id,
            monto: deposito.montoDeclarado,
            cajaOrigen: deposito.cajaOrigen,
            cajaRecepcion: recepcion?.tipo || null,
            accion: aplicar ? 'APLICAR' : 'VISTA_PREVIA',
        }))

        if (!aplicar) continue
        if (!origen?.ubicacionId || !recepcion || recepcion.tipo === deposito.cajaOrigen) {
            throw new Error(`No se encontró una Caja Fuerte válida para el depósito ${deposito.id}.`)
        }
        const ubicacionId = origen.ubicacionId

        await prisma.$transaction(async tx => {
            const lockKey = `backfill-deposito-caja-fuerte:${deposito.id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`
            const actual = await tx.depositoCaja.findUnique({ where: { id: deposito.id } })
            if (!actual || actual.estado !== 'pendiente' || actual.cajaRecepcion || actual.movimientoRecepcionId) return

            const movimientoRecepcion = await CajaService.createMovimiento({
                tipo: 'ingreso',
                concepto: recepcion.conceptoDeposito,
                monto: actual.montoDeclarado,
                ubicacionCajaId: ubicacionId,
                medioPago: 'efectivo',
                cajaOrigen: recepcion.tipo,
                descripcion: `Sobre recibido desde ${actual.cajaOrigen}, asociado al corregir el circuito pendiente`,
                usuarioId: actual.declaradoPorId,
                fecha: actual.fecha,
            }, tx)

            await tx.depositoCaja.update({
                where: { id: actual.id },
                data: {
                    cajaRecepcion: recepcion.tipo,
                    movimientoRecepcionId: movimientoRecepcion.id,
                },
            })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    }
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
