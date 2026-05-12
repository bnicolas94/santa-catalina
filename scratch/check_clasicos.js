const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Check the product
    const productos = await prisma.producto.findMany({
        where: { codigoInterno: { contains: 'CLA', mode: 'insensitive' } },
        include: {
            presentaciones: true,
            fichasTecnicas: {
                include: {
                    insumo: { select: { id: true, nombre: true, stockActual: true } }
                }
            }
        }
    });
    console.log('=== PRODUCTO CLASICOS ===');
    console.log(JSON.stringify(productos, null, 2));

    // 2. Check if there are existing lotes for today to detect ID collision
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const endOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999));
    
    if (productos.length > 0) {
        const pid = productos[0].id;
        const existingLotes = await prisma.lote.findMany({
            where: {
                productoId: pid,
                fechaProduccion: { gte: startOfDay, lte: endOfDay }
            },
            select: { id: true, estado: true, unidadesProducidas: true }
        });
        console.log('\n=== LOTES CLASICOS HOY ===');
        console.log(JSON.stringify(existingLotes, null, 2));

        // 3. Check what the generated ID would be
        const countHoy = existingLotes.length;
        const yyyymmdd = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
        const nextId = `SC-${yyyymmdd}-${productos[0].codigoInterno}-${String(countHoy + 1).padStart(2, '0')}`;
        console.log('\n=== NEXT LOTE ID ===');
        console.log(nextId);

        // 4. Check if that ID already exists
        const existing = await prisma.lote.findUnique({ where: { id: nextId } });
        console.log('Already exists?', !!existing);
        if (existing) {
            console.log('COLLISION DETECTED!', JSON.stringify(existing, null, 2));
        }
    }
}

main().catch(err => console.error('ERROR:', err)).finally(() => prisma.$disconnect());
