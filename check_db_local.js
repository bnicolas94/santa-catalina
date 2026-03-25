const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const mov = await prisma.movimientoMercadoPago.findUnique({
            where: { mpId: '151140345873' }
        });
        console.log('--- Movimiento MP ---');
        console.log(JSON.stringify(mov, null, 2));

        const mCaja = await prisma.movimientoCaja.findFirst({
            where: { descripcion: { contains: '151140345873' } }
        });
        console.log('--- Movimiento Caja ---');
        console.log(JSON.stringify(mCaja, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

main();
