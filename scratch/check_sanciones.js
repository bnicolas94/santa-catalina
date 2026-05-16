const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const sanciones = await prisma.sancion.findMany({
        orderBy: { fecha: 'desc' },
        take: 5
    })
    console.log(JSON.stringify(sanciones, null, 2))
}
main().finally(() => prisma.$disconnect())
