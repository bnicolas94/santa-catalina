const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { subDays } = require('date-fns')

async function main() {
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
        
        // Buscar inasistencias reales que AUN EXISTEN en ese periodo
        const inasistencias = await prisma.inasistencia.findMany({
            where: {
                empleadoId: sancion.empleadoId,
                tipo: alerta.tipoInasistencia,
                fecha: { gte: fechaLimite, lte: sancion.fecha }
            },
            orderBy: { fecha: 'asc' }
        })

        const countActual = inasistencias.length

        if (countActual < alerta.limiteMaximo) {
            // Ya no supera el limite, borrar sancion
            await prisma.sancion.delete({ where: { id: sancion.id } })
            eliminadas++
            console.log(`Eliminada sanción ${sancion.id} del empleado ${sancion.empleadoId} porque su conteo real bajó a ${countActual}`)
        } else {
            // Actualizar texto si cambio
            const fechasStr = inasistencias.map(e => new Date(e.fecha).toLocaleDateString('es-AR')).join(', ')
            const nuevoMotivo = `Automático por alerta: ${alerta.tipoInasistencia} (Límite: ${alerta.limiteMaximo}, Actual: ${countActual})`
            const nuevasObs = `Sanción generada automáticamente por sistema de alertas. Fechas de los hechos: ${fechasStr}. (conteo: ${countActual})`
            
            if (sancion.motivo !== nuevoMotivo || sancion.observaciones !== nuevasObs) {
                await prisma.sancion.update({
                    where: { id: sancion.id },
                    data: { motivo: nuevoMotivo, observaciones: nuevasObs }
                })
                actualizadas++
                console.log(`Actualizada sanción ${sancion.id} del empleado ${sancion.empleadoId}. Nuevo conteo: ${countActual}, Fechas: ${fechasStr}`)
            }
        }
    }

    console.log(`Proceso terminado. Sanciones actualizadas: ${actualizadas}, Sanciones eliminadas: ${eliminadas}`)
}

main().finally(() => prisma.$disconnect())
