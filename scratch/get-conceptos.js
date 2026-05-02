const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const conceptos = await prisma.conceptoSalarial.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, tipo: true }
  })
  console.log(JSON.stringify(conceptos))
}

main().catch(console.error).finally(() => prisma.$disconnect())
