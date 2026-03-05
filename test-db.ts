import { prisma } from './lib/prisma'

async function main() {
    try {
        const counts = await prisma.stockProducto.count()
        console.log('Total stock records:', counts)
        const samples = await prisma.stockProducto.findMany({ take: 5, include: { producto: true, presentacion: true } })
        console.log('Sample records:', JSON.stringify(samples, null, 2))
    } catch (e) {
        console.error('Prisma Error:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
