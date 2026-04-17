import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Iniciando análisis de clientes duplicados...");

    // Obtener todos los clientes ordenados por fecha (los más viejos primero)
    const clientes = await prisma.cliente.findMany({
        include: { _count: { select: { pedidos: true, entregas: true } } },
        orderBy: { createdAt: 'asc' }
    });

    const agrupados = new Map<string, typeof clientes>();

    for (const c of clientes) {
        const key = c.nombreComercial.trim().toLowerCase();
        if (!agrupados.has(key)) agrupados.set(key, []);
        agrupados.get(key)!.push(c);
    }

    let duplicadosBorrados = 0;
    let pedidosRescatados = 0;

    for (const [nombre, grupo] of agrupados.entries()) {
        if (grupo.length > 1) {
            console.log(`\n===========================================`);
            console.log(`Detectado duplicado: "${nombre.toUpperCase()}" (${grupo.length} registros)`);
            
            // Prioridad: Mantener el registro que ya tenga mayor cantidad de pedidos.
            // Si empatan, se queda con el más antiguo (gracias al orderBy previo).
            grupo.sort((a, b) => b._count.pedidos - a._count.pedidos);
            
            const principal = grupo[0];
            const duplicados = grupo.slice(1);

            for (const duplicado of duplicados) {
                // Transferir pedidos y entregas
                if (duplicado._count.pedidos > 0 || duplicado._count.entregas > 0) {
                    const updPedidos = await prisma.pedido.updateMany({
                        where: { clienteId: duplicado.id },
                        data: { clienteId: principal.id }
                    });
                    const updEntregas = await prisma.entrega.updateMany({
                        where: { clienteId: duplicado.id },
                        data: { clienteId: principal.id }
                    });
                    pedidosRescatados += updPedidos.count;
                    console.log(` -> Rescatados ${updPedidos.count} pedidos y ${updEntregas.count} entregas desde el ID: ${duplicado.id.substring(0, 8)}...`);
                }

                // Ahora sí podemos eliminar el duplicado de forma segura
                await prisma.cliente.delete({ where: { id: duplicado.id } });
                duplicadosBorrados++;
                console.log(` -> Cliente duplicado eliminado.`);
            }
        }
    }

    console.log(`\n===========================================`);
    console.log(`PROCESO COMPLETADO.`);
    console.log(`Total de duplicados depurados: ${duplicadosBorrados}`);
    console.log(`Total de pedidos transferidos e intactos: ${pedidosRescatados}`);
}

main()
    .catch(e => {
        console.error("Error crítico durante la limpieza:", e);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
