const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const emp = await prisma.empleado.findFirst({
        where: { nombre: { contains: 'Yaqueline' }, apellido: { contains: 'Acosta' } }
    })
    console.log("Yaqueline Activo:", emp.activo)

    const diasStr = (emp.diasTrabajoSemana || "Lunes a Viernes").toLowerCase()
    const noTrabajaDomingo = !diasStr.includes('domingo')
    const noTrabajaSabado = diasStr.includes('lunes a viernes')

    console.log({ diasStr, noTrabajaDomingo, noTrabajaSabado })

    const inasistencias = await prisma.inasistencia.findMany({
        where: {
            empleadoId: emp.id,
            tipo: 'INJUSTIFICADA',
            motivo: 'Ausencia detectada automáticamente por falta de fichada.'
        }
    })

    console.log("Inasistencias encontradas:", inasistencias.length)

    for (const inas of inasistencias) {
        const date = new Date(inas.fecha)
        const day = date.getUTCDay()
        console.log(`Fecha: ${date.toISOString()}, Day: ${day}, Eliminar?: ${(day === 0 && noTrabajaDomingo) || (day === 6 && noTrabajaSabado)}`)
        
        if ((day === 0 && noTrabajaDomingo) || (day === 6 && noTrabajaSabado)) {
            await prisma.inasistencia.delete({ where: { id: inas.id } })
            console.log("-> ELIMINADA")
        }
    }
}
main().finally(() => prisma.$disconnect())
