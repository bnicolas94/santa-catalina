const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { subDays } = require('date-fns')

async function main() {
    const sanciones = await prisma.sancion.findMany({
        where: { empleadoId: '016bd900-a7c5-4907-8eee-0073f235337e', alertaId: { not: null } }
    })

    console.log("Sanciones a procesar:", sanciones.length)

    for (const sancion of sanciones) {
        const alerta = await prisma.alertaAusentismo.findUnique({
            where: { id: sancion.alertaId }
        })
        if (!alerta) {
            console.log("Alerta no encontrada:", sancion.alertaId)
            continue
        }

        const fechaLimite = subDays(new Date(sancion.fecha), alerta.periodoDias)
        
        const inasistencias = await prisma.inasistencia.findMany({
            where: {
                empleadoId: sancion.empleadoId,
                tipo: alerta.tipoInasistencia,
                fecha: { gte: fechaLimite, lte: sancion.fecha }
            },
            orderBy: { fecha: 'asc' }
        })

        const countActual = inasistencias.length
        console.log(`Sancion ID: ${sancion.id}, Count Actual: ${countActual}, Limite: ${alerta.limiteMaximo}`)

        if (countActual < alerta.limiteMaximo) {
            console.log("  -> Debería borrarse")
        } else {
            const fechasStr = inasistencias.map(e => new Date(e.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })).join(', ')
            const nuevoMotivo = `Automático por alerta: ${alerta.tipoInasistencia} (Límite: ${alerta.limiteMaximo}, Actual: ${countActual})`
            const nuevasObs = `Sanción generada automáticamente por sistema de alertas. Fechas de los hechos: ${fechasStr}. (conteo: ${countActual})`
            
            console.log("  -> Motivo Actual:", sancion.motivo)
            console.log("  -> Motivo Nuevo :", nuevoMotivo)
            console.log("  -> Obs Actual   :", sancion.observaciones)
            console.log("  -> Obs Nuevo    :", nuevasObs)

            if (sancion.motivo !== nuevoMotivo || sancion.observaciones !== nuevasObs) {
                console.log("  -> DEBE ACTUALIZARSE")
                await prisma.sancion.update({
                    where: { id: sancion.id },
                    data: { motivo: nuevoMotivo, observaciones: nuevasObs }
                })
            }
        }
    }
}
main().finally(() => prisma.$disconnect())
