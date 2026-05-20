const { getCostosReport } = require('../lib/services/reportes-costos');

async function main() {
    const report = await getCostosReport(
        '2026-05-01T00:00:00.000Z',
        '2026-05-31T23:59:59.999Z',
        undefined,
        true
    );

    console.log('=== REPORT KPI ===');
    console.log(report.kpis);

    console.log('\n=== RANKING INSUMOS ===');
    console.log(report.rankingInsumos.map(i => ({
        id: i.id,
        nombre: i.nombre,
        familia: i.familia,
        costoTotal: i.costoTotal,
        cantidad: i.cantidadComprada,
        compras: i.compras
    })));

    console.log('\n=== GASTOS POR CATEGORIA ===');
    console.log(report.gastosPorCategoria);
}

main().catch(err => console.error(err));
