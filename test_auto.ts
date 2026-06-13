import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const chofer = await prisma.empleado.findFirst({where:{rol:'LOGISTICA'}});
    const pedido = await prisma.pedido.findFirst({where:{estado:'confirmado', esRetiro: false, fechaEntrega: { gte: new Date('2026-06-13T00:00:00.000Z') }}});
    console.log(chofer?.id, pedido?.id);
    if (!chofer || !pedido) return;
    try {
        await prisma.$transaction(async (tx) => {
            const r = await tx.ruta.create({
                data: {
                    choferId: chofer.id,
                    fecha: new Date('2026-06-13'),
                    entregas: {
                        create: [{
                            pedidoId: pedido.id,
                            clienteId: pedido.clienteId,
                            orden: 0
                        }]
                    }
                }
            });
            console.log('Ruta creada', r.id);
            // Intentar replicar descuento de stock
            const detallesPedidos = await tx.detallePedido.findMany({
                where: { pedidoId: pedido.id },
                include: { presentacion: true }
            });
            const consolidado: any = {};
            detallesPedidos.forEach(det => {
                const key = det.presentacionId;
                if (!consolidado[key] && det.presentacion) consolidado[key] = { productoId: det.presentacion.productoId, cantidad: 0 };
                if (consolidado[key]) consolidado[key].cantidad += det.cantidad;
            });
            const finalOrigenId = 'test-id'; // Esto va a fallar, usemos el de fabrica real
            const fabrica = await tx.ubicacion.findFirst({ where: { tipo: 'FABRICA' } });
            if (!fabrica) throw new Error('No hay fabrica');
            for (const [presId, info] of Object.entries(consolidado)) {
                await tx.stockProducto.upsert({
                    where: { productoId_presentacionId_ubicacionId: { productoId: info.productoId, presentacionId: presId, ubicacionId: fabrica.id } },
                    update: { cantidad: { decrement: info.cantidad } },
                    create: { productoId: info.productoId, presentacionId: presId, ubicacionId: fabrica.id, cantidad: -info.cantidad }
                });
                await tx.movimientoProducto.create({
                    data: { tipo: 'salida_ruta', cantidad: info.cantidad, signo: 'salida', productoId: info.productoId, presentacionId: presId, ubicacionId: fabrica.id, rutaId: r.id, observaciones: 'Salida' }
                });
            }
        });
    } catch(e) {
        console.error('Error:', e);
    }
}
main().finally(()=>prisma.$disconnect());
