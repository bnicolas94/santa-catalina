const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find all insumos containing "pan"
    const insumos = await prisma.insumo.findMany({
        where: {
            OR: [
                { nombre: { contains: 'pan', mode: 'insensitive' } },
                { nombre: { contains: 'miga', mode: 'insensitive' } }
            ]
        },
        include: {
            familia: true
        }
    });

    console.log('=== INSUMOS ENCONTRADOS ===');
    console.log(JSON.stringify(insumos.map(i => ({
        id: i.id,
        nombre: i.nombre,
        activo: i.activo,
        precioUnitario: i.precioUnitario,
        familia: i.familia?.nombre,
        unidadMedida: i.unidadMedida,
        stockActual: i.stockActual
    })), null, 2));

    // Get recent stock movements for these insumos
    const insumoIds = insumos.map(i => i.id);
    const recentMovements = await prisma.movimientoStock.findMany({
        where: {
            insumoId: { in: insumoIds },
            tipo: 'entrada'
        },
        take: 15,
        orderBy: { fecha: 'desc' },
        include: {
            insumo: { select: { nombre: true } },
            proveedor: { select: { nombre: true } }
        }
    });

    console.log('\n=== RECIENTES MOVIMIENTOS DE ENTRADA (STOCK) ===');
    console.log(JSON.stringify(recentMovements.map(m => ({
        id: m.id,
        fecha: m.fecha,
        insumo: m.insumo.nombre,
        cantidad: m.cantidad,
        costoTotal: m.costoTotal,
        precioUnitario: m.cantidad > 0 ? (m.costoTotal / m.cantidad) : 0,
        proveedor: m.proveedor?.nombre,
        numeroFactura: m.numeroFactura,
        tipo: m.tipo
    })), null, 2));

    // Let's also check the gastosOperativos that might contain "pan" in description or category
    const recentGastos = await prisma.gastoOperativo.findMany({
        where: {
            OR: [
                { descripcion: { contains: 'pan', mode: 'insensitive' } }
            ]
        },
        take: 10,
        orderBy: { fecha: 'desc' },
        include: {
            categoria: true
        }
    });

    console.log('\n=== GASTOS OPERATIVOS CON "PAN" EN DESCRIPCION ===');
    console.log(JSON.stringify(recentGastos.map(g => ({
        id: g.id,
        fecha: g.fecha,
        descripcion: g.descripcion,
        monto: g.monto,
        categoria: g.categoria?.nombre
    })), null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
