const { getLiquidacionDateRange } = require('../lib/services/reportes-costos');

// Test: Reporte de Abril 2026
const abrilStart = new Date(2026, 3, 1);  // 1 de abril
const abrilEnd = new Date(2026, 3, 30, 23, 59, 59, 999); // 30 de abril

const { liqStart, liqEnd } = getLiquidacionDateRange(abrilStart, abrilEnd);

console.log('=== REPORTE DE ABRIL 2026 ===');
console.log('Período del reporte:', abrilStart.toLocaleDateString('es-AR'), '-', abrilEnd.toLocaleDateString('es-AR'));
console.log('');
console.log('Rango ajustado para liquidaciones:');
console.log('  Desde:', liqStart.toLocaleDateString('es-AR'), '(día 7 de abril)');
console.log('  Hasta:', liqEnd.toLocaleDateString('es-AR'), '(día 6 de mayo)');
console.log('');

// Simular casos
const casos = [
    { fecha: new Date(2026, 3, 3), desc: 'Liquidación del 3/4 (primeros 6 días de abril)' },
    { fecha: new Date(2026, 3, 7), desc: 'Liquidación del 7/4 (día 7 de abril)' },
    { fecha: new Date(2026, 3, 15), desc: 'Liquidación del 15/4 (mitad de abril)' },
    { fecha: new Date(2026, 3, 27), desc: 'Liquidación del 27/4' },
    { fecha: new Date(2026, 4, 3), desc: 'Liquidación del 3/5 (primeros 6 días de mayo)' },
    { fecha: new Date(2026, 4, 6), desc: 'Liquidación del 6/5 (día 6 de mayo)' },
    { fecha: new Date(2026, 4, 7), desc: 'Liquidación del 7/5 (día 7 de mayo, ya NO pertenece a abril)' },
];

console.log('Resultados:');
for (const c of casos) {
    const incluida = c.fecha >= liqStart && c.fecha <= liqEnd;
    const status = incluida ? '✅ INCLUIDA en Abril' : '❌ EXCLUIDA de Abril';
    console.log(`  ${c.desc} → ${status}`);
}

// Test: Reporte de Mayo 2026
const mayoStart = new Date(2026, 4, 1);
const mayoEnd = new Date(2026, 4, 31, 23, 59, 59, 999);
const { liqStart: liqStartMayo, liqEnd: liqEndMayo } = getLiquidacionDateRange(mayoStart, mayoEnd);

console.log('');
console.log('=== REPORTE DE MAYO 2026 ===');
console.log('Rango ajustado para liquidaciones:');
console.log('  Desde:', liqStartMayo.toLocaleDateString('es-AR'), '(día 7 de mayo)');
console.log('  Hasta:', liqEndMayo.toLocaleDateString('es-AR'), '(día 6 de junio)');

const casosMayo = [
    { fecha: new Date(2026, 4, 3), desc: 'Liquidación del 3/5 (pertenece a Abril)' },
    { fecha: new Date(2026, 4, 7), desc: 'Liquidación del 7/5 (pertenece a Mayo)' },
    { fecha: new Date(2026, 5, 5), desc: 'Liquidación del 5/6 (pertenece a Mayo)' },
    { fecha: new Date(2026, 5, 7), desc: 'Liquidación del 7/6 (pertenece a Junio)' },
];

console.log('');
console.log('Resultados:');
for (const c of casosMayo) {
    const incluida = c.fecha >= liqStartMayo && c.fecha <= liqEndMayo;
    const status = incluida ? '✅ INCLUIDA en Mayo' : '❌ EXCLUIDA de Mayo';
    console.log(`  ${c.desc} → ${status}`);
}
