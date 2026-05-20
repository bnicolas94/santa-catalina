const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const desdeIso = '2026-05-01T00:00:00.000Z';
    const hastaIso = '2026-05-31T23:59:59.999Z';
    const startOfMonth = new Date(desdeIso);
    const endOfMonth = new Date(hastaIso);

    const wherePedido = {
        estado: { in: ['entregado', 'confirmado', 'en_camino', 'pendiente'] },
        fechaEntrega: { gte: startOfMonth, lte: endOfMonth }
    };

    const pedidos = await prisma.pedido.findMany({
        where: wherePedido,
        include: {
            detalles: {
                include: {
                    presentacion: {
                        include: {
                            producto: {
                                include: { fichasTecnicas: { include: { insumo: true } } }
                            }
                        }
                    }
                }
            }
        }
    });

    let ingresosTotales = 0;
    let costoMercaderiaVendida = 0;
    let isCmvFallback = false;

    for (const ped of pedidos) {
        ingresosTotales += ped.totalImporte;
        for (const det of ped.detalles) {
            if (det.costoUnitarioHistorico !== null && det.costoUnitarioHistorico !== undefined) {
                costoMercaderiaVendida += det.costoUnitarioHistorico * det.cantidad;
            } else {
                let costoPorSandwich = 0;
                for (const ft of det.presentacion.producto.fichasTecnicas) {
                    costoPorSandwich += ft.cantidadPorUnidad * (ft.insumo.precioUnitario || 0);
                }
                costoMercaderiaVendida += costoPorSandwich * det.presentacion.cantidad * det.cantidad;
            }
        }
    }

    console.log('Ingresos Totales (todos los estados):', ingresosTotales);
    console.log('CMV (antes de fallback):', costoMercaderiaVendida);

    if (costoMercaderiaVendida === 0) {
        const comprasActual = await prisma.movimientoStock.aggregate({
            where: {
                tipo: 'entrada',
                fecha: { gte: startOfMonth, lte: endOfMonth }
            },
            _sum: { costoTotal: true }
        });
        costoMercaderiaVendida = comprasActual._sum.costoTotal || 0;
        isCmvFallback = true;
    }

    console.log('CMV (después de fallback):', costoMercaderiaVendida);
    console.log('isCmvFallback:', isCmvFallback);

    const margenBruto = ingresosTotales - costoMercaderiaVendida;

    const whereGasto = { fecha: { gte: startOfMonth, lte: endOfMonth } };
    const gastos = await prisma.gastoOperativo.findMany({
        where: { ...whereGasto, movimientosStock: { none: {} } },
        include: { categoria: true }
    });

    const totalGastos = gastos
        .filter(g => g.categoria.esOperativo)
        .reduce((acc, g) => acc + g.monto, 0);

    const rentabilidadNeta = margenBruto - totalGastos;

    console.log('Gastos Operativos (excluyendo stock):', totalGastos);
    console.log('Rentabilidad Neta:', rentabilidadNeta);
    console.log('Margen EBITDA:', ingresosTotales > 0 ? (rentabilidadNeta / ingresosTotales) * 100 : 0);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
