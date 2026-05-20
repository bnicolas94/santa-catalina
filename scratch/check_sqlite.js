const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:../prisma/dev.db'
        }
    }
});

async function main() {
    const models = [
        'insumo', 'producto', 'presentacion', 'fichaTecnica', 'lote', 'movimientoStock',
        'gastoOperativo', 'categoriaGasto', 'ubicacion', 'empleado', 'pedido', 'detallePedido'
    ];

    console.log('=== ROW COUNTS IN LOCAL SQLITE ===');
    for (const model of models) {
        try {
            const count = await prisma[model].count();
            console.log(`${model}: ${count}`);
        } catch (e) {
            console.log(`${model}: Error - ${e.message}`);
        }
    }

    try {
        const fichas = await prisma.fichaTecnica.findMany({
            include: { producto: true, insumo: true }
        });
        console.log('Fichas in SQLite:', fichas.length);
        if (fichas.length > 0) {
            console.log(fichas.slice(0, 5).map(f => ({
                producto: f.producto.nombre,
                insumo: f.insumo.nombre,
                cantidad: f.cantidadPorUnidad
            })));
        }
    } catch (e) {
        console.log('Error reading fichas from SQLite:', e.message);
    }
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
