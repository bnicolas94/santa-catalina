import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Limpiando fichadas mal cargadas de Febrero ---')
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result = await prisma.fichadaEmpleado.deleteMany({
        where: {
            createdAt: { gte: today },
            fechaHora: {
                gte: new Date('2026-02-01T00:00:00Z'),
                lte: new Date('2026-02-28T23:59:59Z')
            }
        }
    })

    console.log(`¡Éxito! Se eliminaron ${result.count} registros erróneos de Febrero.`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
