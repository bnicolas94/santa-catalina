const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const sanciones = await prisma.sancion.findMany({
        where: { empleadoId: '016bd900-a7c5-4907-8eee-0073f235337e' }
    })
    console.log("Sanciones Yaqueline:", sanciones)
}
main().finally(() => prisma.$disconnect())
