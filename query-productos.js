const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const conceptos = await prisma.conceptoCaja.findMany({ orderBy: { nombre: 'asc' } });
  console.log("=== CONCEPTOS DE CAJA ===");
  console.log(JSON.stringify(conceptos, null, 2));
  
  // Also check distinct conceptos used in movimientos
  const distinctConceptos = await prisma.movimientoCaja.findMany({
    where: { tipo: 'egreso' },
    distinct: ['concepto'],
    select: { concepto: true },
    orderBy: { concepto: 'asc' }
  });
  console.log("\n=== CONCEPTOS USADOS EN EGRESOS ===");
  console.log(JSON.stringify(distinctConceptos, null, 2));
  
  // Sample egresos
  const sample = await prisma.movimientoCaja.findMany({
    where: { tipo: 'egreso' },
    take: 5,
    orderBy: { fecha: 'desc' },
    select: { id: true, fecha: true, concepto: true, monto: true, descripcion: true, gastoId: true }
  });
  console.log("\n=== ULTIMOS 5 EGRESOS ===");
  console.log(JSON.stringify(sample, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
