const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const draft = await prisma.liquidacionSueldo.findFirst({
    where: { empleado: { nombre: 'German' }, estado: 'borrador' }
  });
  console.log(JSON.stringify(draft, null, 2));
}

main().finally(() => prisma.$disconnect());
