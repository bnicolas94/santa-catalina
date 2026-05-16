const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const empleados = await prisma.empleado.findMany({
        where: { activo: true },
        select: { id: true, diasTrabajoSemana: true }
    })

    let eliminados = 0

    for (const emp of empleados) {
        const diasStr = (emp.diasTrabajoSemana || "Lunes a Viernes").toLowerCase()
        const noTrabajaDomingo = !diasStr.includes('domingo')
        const noTrabajaSabado = diasStr.includes('lunes a viernes')

        // Buscar todas sus inasistencias generadas automáticamente
        const inasistencias = await prisma.inasistencia.findMany({
            where: {
                empleadoId: emp.id,
                tipo: 'INJUSTIFICADA',
                motivo: 'Ausencia detectada automáticamente por falta de fichada.'
            }
        })

        for (const inas of inasistencias) {
            const date = new Date(inas.fecha)
            const day = date.getUTCDay()

            if ((day === 0 && noTrabajaDomingo) || (day === 6 && noTrabajaSabado)) {
                await prisma.inasistencia.delete({
                    where: { id: inas.id }
                })
                eliminados++
                console.log(`Eliminada inasistencia incorrecta: Empleado ${emp.id}, Fecha: ${date.toISOString()}`)
            }
        }
    }

    console.log(`Proceso terminado. Se eliminaron ${eliminados} inasistencias incorrectas generadas en días de franco.`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
