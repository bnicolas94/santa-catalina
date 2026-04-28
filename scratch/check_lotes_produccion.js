const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const lotes = await prisma.lote.findMany({
        where: { estado: 'en_produccion' },
        include: { producto: true }
    });
    console.log(JSON.stringify(lotes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
