const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = {
        productoId: "545ea4e3-6b3e-4a1c-859a-5732a0b5cfeb", // Clásicos
        fechaProduccion: "2026-05-12",
        unidadesProducidas: "14",
        empleadosRonda: "1",
        coordinadorId: "",
        estado: "en_produccion",
        ubicacionId: "e6a67ca4-e4a9-4a4e-9402-7d987e164a21" // Central
    };

    console.log('Simulating POST /api/lotes with:', data);

    try {
        const [year, month, day] = data.fechaProduccion.split('-').map(Number);
        const fecha = new Date(Date.UTC(year, month - 1, day));
        const yyyymmdd = data.fechaProduccion.replace(/-/g, '');

        const startOfProdDay = new Date(fecha);
        startOfProdDay.setHours(0, 0, 0, 0);
        const endOfProdDay = new Date(fecha);
        endOfProdDay.setHours(23, 59, 59, 999);

        const producto = await prisma.producto.findUnique({ where: { id: data.productoId } });
        if (!producto) throw new Error('Producto no encontrado');

        const prefix = `SC-${yyyymmdd}-${producto.codigoInterno}-`;
        const existingLotes = await prisma.lote.findMany({
            where: { id: { startsWith: prefix } },
            select: { id: true },
            orderBy: { id: 'desc' },
            take: 1
        });
        
        let nextNum = 1;
        if (existingLotes.length > 0) {
            const lastId = existingLotes[0].id;
            const lastNumStr = lastId.replace(prefix, '');
            const lastNum = parseInt(lastNumStr) || 0;
            nextNum = lastNum + 1;
        }

        const loteId = `${prefix}${String(nextNum).padStart(2, '0')}`;
        const qtyPaquetes = parseInt(data.unidadesProducidas);

        console.log('Generated Lote ID:', loteId);

        const result = await prisma.$transaction(async (tx) => {
            const nuevoLote = await tx.lote.create({
                data: {
                    id: loteId,
                    fechaProduccion: fecha,
                    horaInicio: new Date(),
                    unidadesProducidas: qtyPaquetes,
                    empleadosRonda: parseInt(data.empleadosRonda) || 1,
                    estado: data.estado || 'en_camara',
                    productoId: data.productoId,
                    coordinadorId: data.coordinadorId || null,
                    ubicacionId: data.ubicacionId,
                    distribucion: null, // Simulated
                },
                include: { producto: true }
            });
            return nuevoLote;
        });

        console.log('SUCCESS:', result.id);
        
        // Clean up
        await prisma.lote.delete({ where: { id: result.id } });
        console.log('Deleted test lote.');

    } catch (error) {
        console.error('FAILURE:', error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
