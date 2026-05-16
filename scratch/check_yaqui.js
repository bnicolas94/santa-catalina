const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const empleados = await prisma.empleado.findMany({
        where: { nombre: { contains: 'Yaqueline' }, apellido: { contains: 'Acosta' } },
        select: { id: true, nombre: true, apellido: true, diasTrabajoSemana: true }
    })
    console.log("Empleado:", empleados)

    const inasistencias = await prisma.inasistencia.findMany({
        where: { empleadoId: empleados[0]?.id },
        orderBy: { fecha: 'asc' }
    })
    console.log("Inasistencias:", inasistencias)
}
main().finally(() => prisma.$disconnect())
