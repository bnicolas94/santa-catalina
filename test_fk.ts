import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // 1. Conseguir todos los pedidos de la tarde del 13/06 que esten en estado confirmado
    const pedidos = await prisma.pedido.findMany({
        where: {
            fechaEntrega: { gte: new Date('2026-06-13T00:00:00.000Z'), lte: new Date('2026-06-13T23:59:59.999Z') },
            estado: 'confirmado',
            esRetiro: false
        },
        include: { cliente: true }
    });

    const chofer = await prisma.empleado.findFirst({where:{rol:'LOGISTICA'}});
    if (!chofer) return;

    console.log('Pedidos encontrados:', pedidos.length);
    // Vamos a intentar insertar cada uno en una "Entrega" falsa para ver cual falla la constraint
    for (const p of pedidos) {
        try {
            await prisma.$transaction(async (tx) => {
                const r = await tx.ruta.create({
                    data: {
                        choferId: chofer.id,
                        fecha: new Date('2026-06-13'),
                        entregas: {
                            create: [{ pedidoId: p.id, clienteId: p.clienteId, orden: 0 }]
                        }
                    }
                });
                // abort the transaction so we don't save
                throw new Error('ROLLBACK_SUCCESS');
            });
        } catch(e: any) {
            if (e.message !== 'ROLLBACK_SUCCESS') {
                console.error(`Fallo pedido ${p.id}:`, e.message);
            }
        }
    }
    console.log('Test terminado');
}
main().finally(()=>prisma.$disconnect());
