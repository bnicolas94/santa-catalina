const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Investigating Clásicos Product Data ---');
    
    const product = await prisma.producto.findFirst({
        where: {
            OR: [
                { nombre: { contains: 'Clasico', mode: 'insensitive' } },
                { codigoInterno: { contains: 'CLA', mode: 'insensitive' } }
            ]
        },
        include: {
            fichasTecnicas: {
                include: {
                    insumo: true
                }
            }
        }
    });

    if (!product) {
        console.log('Product "Clásicos" not found.');
        return;
    }

    console.log('Product found:', {
        id: product.id,
        nombre: product.nombre,
        codigoInterno: product.codigoInterno,
        activo: product.activo
    });

    console.log('Fichas Técnicas count:', product.fichasTecnicas.length);
    
    for (const ft of product.fichasTecnicas) {
        console.log(`- Insumo: ${ft.insumo?.nombre || 'MISSING!'} (ID: ${ft.insumoId})`);
        console.log(`  Cantidad por unidad: ${ft.cantidadPorUnidad}`);
        if (!ft.insumo) {
            console.error(`  ERROR: FichaTecnica ${ft.id} references non-existent Insumo ${ft.insumoId}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
