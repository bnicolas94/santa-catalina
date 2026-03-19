import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const queso = await prisma.insumo.findFirst({
    where: { nombre: { contains: 'Queso' } },
    include: { stocks: true }
  })
  console.log('QUESO DETAILS:', JSON.stringify(queso, null, 2))
  
  const ubicaciones = await prisma.ubicacion.findMany()
  console.log('UBICACIONES:', JSON.stringify(ubicaciones, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
