const { getRentabilidadReport } = require('../lib/services/reportes');

async function main() {
    const report = await getRentabilidadReport(
        '2026-05-01T00:00:00.000Z',
        '2026-05-31T23:59:59.999Z',
        undefined,
        true
    );

    console.log('=== RENTABILIDAD REPORT ===');
    console.log(JSON.stringify(report, null, 2));
}

main().catch(err => console.error(err));
