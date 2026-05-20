const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.producto.findMany({
        include: {
            fichasTecnicas: {
                include: { insumo: true }
            },
            presentaciones: true
        }
    });

    console.log('=== PRODUCTS IN POSTGRESQL ===');
    console.log(JSON.stringify(products.map(p => ({
        id: p.id,
        nombre: p.nombre,
        codigoInterno: p.codigoInterno,
        fichasCount: p.fichasTecnicas.length,
        presentaciones: p.presentaciones.map(pr => `${pr.cantidad} uds ($${pr.precioVenta})`)
    })), null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
