const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const inasistencias = await prisma.inasistencia.findMany({
        where: { empleadoId: '016bd900-a7c5-4907-8eee-0073f235337e' }
    })
    console.log("Todas:", inasistencias.map(i => ({ fecha: i.fecha, motivo: i.motivo })))
}
main().finally(() => prisma.$disconnect())
