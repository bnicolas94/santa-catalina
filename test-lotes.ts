import { prisma } from './lib/prisma'

async function main() {
    try {
        const lotes = await prisma.lote.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { producto: true }
        })
        console.log('Recent Lotes:', JSON.stringify(lotes, null, 2))
    } catch (e) {
        console.error('Prisma Error:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
