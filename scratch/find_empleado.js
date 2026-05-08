const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const empleado = await prisma.empleado.findFirst({
    where: {
      OR: [
        { nombre: { contains: 'Maria', mode: 'insensitive' } },
        { apellido: { contains: 'Vega', mode: 'insensitive' } }
      ]
    },
    include: {
      liquidacionesFinales: true
    }
  });

  console.log(JSON.stringify(empleado, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
