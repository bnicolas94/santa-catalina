const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const rol = await prisma.rolEmpleado.findUnique({
        where: { id: '60b862e5-90ea-4e1a-a2a2-eb636325ad11' }
    })
    console.log(JSON.stringify(rol, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
