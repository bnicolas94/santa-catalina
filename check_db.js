const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log('Tables in public schema:');
        console.log(JSON.stringify(tables, null, 2));

        const clientes = await prisma.$queryRaw`SELECT count(*) FROM "clientes"`;
        console.log('Count from manual SQL "clientes":', clientes);
    } catch (e) {
        console.error('SQL Query error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
