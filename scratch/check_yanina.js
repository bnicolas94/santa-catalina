const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const prestamos = await prisma.prestamoEmpleado.findMany({
        where: { empleado: { nombre: { contains: 'Yanina' } } },
        include: { cuotas: { orderBy: { numeroCuota: 'asc' } }, empleado: true }
    })
    console.dir(prestamos, { depth: null })
}
main().finally(() => prisma.$disconnect())
