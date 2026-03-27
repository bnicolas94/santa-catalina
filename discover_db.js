const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const schemas = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata`;
        console.log('Available schemas:', JSON.stringify(schemas, null, 2));

        for (const s of schemas) {
            const schemaName = s.schema_name;
            if (['information_schema', 'pg_catalog'].includes(schemaName)) continue;
            
            const tables = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schemaName}'`);
            console.log(`Tables in ${schemaName}:`, tables.length);
            
            if (tables.some(t => t.table_name === 'clientes')) {
                const count = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "${schemaName}"."clientes"`);
                console.log(`Count in ${schemaName}.clientes:`, count);
            }
        }

        // Check if there are any RUTAS
        const rutaCount = await prisma.ruta.count();
        console.log('Total rutas:', rutaCount);
        if (rutaCount > 0) {
            const entregas = await prisma.entrega.findMany({ select: { id: true, orden: true, rutaId: true }, take: 20 });
            console.log('Sample entregas with orden:', JSON.stringify(entregas, null, 2));
        }

    } catch (e) {
        console.error('Discovery error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
