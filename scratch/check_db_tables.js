const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productsCount = await prisma.producto.count();
    const insumosCount = await prisma.insumo.count();
    const fichasCount = await prisma.fichaTecnica.count();
    const proveedoresCount = await prisma.proveedor.count();

    console.log('=== DATABASE COUNTS ===');
    console.log('Products:', productsCount);
    console.log('Insumos:', insumosCount);
    console.log('Fichas Técnicas:', fichasCount);
    console.log('Proveedores:', proveedoresCount);

    const products = await prisma.producto.findMany({ select: { id: true, nombre: true } });
    console.log('\n=== PRODUCTS ===');
    console.log(products);

    const insumos = await prisma.insumo.findMany({ select: { id: true, nombre: true, precioUnitario: true } });
    console.log('\n=== INSUMOS (top 15) ===');
    console.log(insumos.slice(0, 15));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
