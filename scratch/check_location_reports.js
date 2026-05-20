const { getCostosReport } = require('../lib/services/reportes-costos');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const locations = await prisma.ubicacion.findMany();
    for (const loc of locations) {
        console.log(`\n=========================================`);
        console.log(`REPORT FOR LOCATION: ${loc.nombre} (${loc.id})`);
        console.log(`=========================================`);
        const report = await getCostosReport(
            '2026-05-01T00:00:00.000Z',
            '2026-05-31T23:59:59.999Z',
            loc.id,
            true
        );
        console.log('KPIs:', report.kpis);
        console.log('Ranking Insumos (top 5):', report.rankingInsumos.slice(0, 5).map(i => ({
            nombre: i.nombre,
            costoTotal: i.costoTotal,
            cantidad: i.cantidadComprada
        })));
    }
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
