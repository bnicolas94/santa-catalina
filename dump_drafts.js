const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const drafts = await prisma.liquidacionSueldo.findMany({
    where: { estado: 'borrador' },
    include: { empleado: true }
  });
  
  const formatted = drafts.map(d => {
    let currentTotalNeto = d.totalNeto;
    return {
      id: d.id,
      nombre: d.empleado.nombre,
      apellido: d.empleado.apellido,
      totalNetoActual: currentTotalNeto,
      desglose: d.desglose,
      items: d.items
    };
  });
  
  require('fs').writeFileSync('drafts_dump.json', JSON.stringify(formatted, null, 2));
  console.log('Dumped to drafts_dump.json');
}

main().finally(() => prisma.$disconnect());
