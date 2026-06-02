const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productos = await prisma.producto.findMany({ select: { id: true, nombre: true, codigoInterno: true, alias: true } });
  console.log(productos);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
