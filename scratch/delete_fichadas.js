const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const start = new Date('2026-05-04T00:00:00Z')
    const end = new Date('2026-05-10T23:59:59Z')
    
    console.log(`Borrando fichadas entre ${start.toISOString()} y ${end.toISOString()}`)
    
    const result = await prisma.fichadaEmpleado.deleteMany({
        where: {
            fechaHora: {
                gte: start,
                lte: end
            }
        }
    })
    
    console.log(`Se borraron ${result.count} fichadas.`)
}

main()
