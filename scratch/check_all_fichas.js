const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const fichas = await prisma.fichaTecnica.findMany({
        include: {
            producto: true,
            insumo: true
        }
    });

    console.log('=== ALL FICHAS TECNICAS ===');
    console.log(JSON.stringify(fichas.map(f => ({
        id: f.id,
        producto: f.producto.nombre,
        insumo: f.insumo.nombre,
        cantidad: f.cantidadPorUnidad,
        unidad: f.unidadMedida
    })), null, 2));

    const insumos = await prisma.insumo.findMany({
        select: { id: true, nombre: true, activo: true }
    });
    console.log('\n=== ALL INSUMOS IN DB ===');
    console.log(JSON.stringify(insumos, null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
