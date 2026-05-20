const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const models = [
        'insumo', 'producto', 'presentacion', 'fichaTecnica', 'lote', 'movimientoStock',
        'gastoOperativo', 'categoriaGasto', 'ubicacion', 'empleado', 'pedido', 'detallePedido'
    ];

    console.log('=== ROW COUNTS ===');
    for (const model of models) {
        try {
            const count = await prisma[model].count();
            console.log(`${model}: ${count}`);
        } catch (e) {
            console.log(`${model}: Error - ${e.message}`);
        }
    }
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
