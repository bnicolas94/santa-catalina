const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const types = await prisma.fichadaEmpleado.findMany({
        select: { tipo: true },
        distinct: ['tipo']
    })
    console.log('Tipos encontrados:', types.map(t => t.tipo))
}

main()
