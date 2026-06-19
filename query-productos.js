const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const liqs = await prisma.liquidacionSueldo.findMany({
    take: 10,
    orderBy: { fechaGeneracion: 'desc' },
    select: { id: true, periodo: true, fechaGeneracion: true, totalNeto: true, estado: true }
  });
  console.log(JSON.stringify(liqs, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
