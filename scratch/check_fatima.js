const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const fatima = await prisma.empleado.findFirst({
        where: { nombre: { contains: 'Fatima' } }
    })
    console.log(JSON.stringify(fatima, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
