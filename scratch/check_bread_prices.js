const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Get bread insumos and their precioUnitario
    const insumos = await prisma.insumo.findMany({
        where: {
            nombre: { contains: 'pan', mode: 'insensitive' }
        },
        include: {
            familia: true
        }
    });
    console.log('=== BREAD INSUMOS ===');
    console.log(JSON.stringify(insumos.map(i => ({
        id: i.id,
        nombre: i.nombre,
        precioUnitario: i.precioUnitario,
        stockActual: i.stockActual,
        activo: i.activo,
        familia: i.familia ? i.familia.nombre : 'None'
    })), null, 2));

    // 2. Get Fichas Tecnicas that use these insumos
    const breadIds = insumos.map(i => i.id);
    const fichas = await prisma.fichaTecnica.findMany({
        where: {
            insumoId: { in: breadIds }
        },
        include: {
            producto: true,
            insumo: true
        }
    });
    console.log('\n=== FICHAS TECNICAS USING BREAD ===');
    console.log(JSON.stringify(fichas.map(f => ({
        id: f.id,
        productoNombre: f.producto.nombre,
        insumoNombre: f.insumo.nombre,
        cantidadPorUnidad: f.cantidadPorUnidad,
        unidadMedida: f.unidadMedida
    })), null, 2));

    // 3. Are there active products?
    const activeProducts = await prisma.producto.findMany({
        where: { activo: true },
        select: { id: true, nombre: true }
    });
    console.log('\n=== ACTIVE PRODUCTS ===');
    console.log('Count:', activeProducts.length);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
