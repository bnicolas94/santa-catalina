const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
    const emp = await prisma.empleado.findFirst({
        where: { nombre: { contains: 'Jeremias' } }
    })
    console.log('Jeremias Data:', JSON.stringify(emp, null, 2))
}

check()
