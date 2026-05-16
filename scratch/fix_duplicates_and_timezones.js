const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { subDays } = require('date-fns')

async function main() {
    // 1. Eliminar inasistencias duplicadas (mismo empleado, mismo dia UTC)
    const inasistencias = await prisma.inasistencia.findMany({
        orderBy: { fecha: 'asc' }
    })

    const vistos = new Set()
    let eliminadasDuplicadas = 0

    for (const inas of inasistencias) {
        const dateStr = inas.fecha.toISOString().split('T')[0]
        const key = `${inas.empleadoId}_${dateStr}`

        if (vistos.has(key)) {
            await prisma.inasistencia.delete({ where: { id: inas.id } })
            eliminadasDuplicadas++
        } else {
            vistos.add(key)
        }
    }
    console.log(`Inasistencias duplicadas eliminadas: ${eliminadasDuplicadas}`)

    // 2. Recalcular Sanciones con TimeZone UTC correcto
    const sancionesAutomaticas = await prisma.sancion.findMany({
        where: { alertaId: { not: null } }
    })

    let actualizadas = 0
    let eliminadas = 0

    for (const sancion of sancionesAutomaticas) {
        const alerta = await prisma.alertaAusentismo.findUnique({
            where: { id: sancion.alertaId }
        })
        if (!alerta) continue

        const fechaLimite = subDays(new Date(sancion.fecha), alerta.periodoDias)
        
        const inasistenciasReales = await prisma.inasistencia.findMany({
            where: {
                empleadoId: sancion.empleadoId,
                tipo: alerta.tipoInasistencia,
                fecha: { gte: fechaLimite, lte: sancion.fecha }
            },
            orderBy: { fecha: 'asc' }
        })

        const countActual = inasistenciasReales.length

        if (countActual < alerta.limiteMaximo) {
            await prisma.sancion.delete({ where: { id: sancion.id } })
            eliminadas++
        } else {
            const fechasStr = inasistenciasReales.map(e => new Date(e.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })).join(', ')
            const nuevoMotivo = `Automático por alerta: ${alerta.tipoInasistencia} (Límite: ${alerta.limiteMaximo}, Actual: ${countActual})`
            const nuevasObs = `Sanción generada automáticamente por sistema de alertas. Fechas de los hechos: ${fechasStr}. (conteo: ${countActual})`
            
            if (sancion.motivo !== nuevoMotivo || sancion.observaciones !== nuevasObs) {
                await prisma.sancion.update({
                    where: { id: sancion.id },
                    data: { motivo: nuevoMotivo, observaciones: nuevasObs }
                })
                actualizadas++
            }
        }
    }

    console.log(`Sanciones actualizadas: ${actualizadas}, Sanciones eliminadas: ${eliminadas}`)
}

main().finally(() => prisma.$disconnect())
