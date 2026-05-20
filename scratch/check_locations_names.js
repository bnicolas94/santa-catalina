const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const locations = await prisma.ubicacion.findMany();
    console.log('=== LOCATIONS IN POSTGRESQL ===');
    console.log(JSON.stringify(locations, null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
