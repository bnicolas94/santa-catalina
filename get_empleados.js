const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const empleados = await prisma.empleado.findMany({ select: { id: true, nombre: true, apellido: true } });
  console.log(JSON.stringify(empleados, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
