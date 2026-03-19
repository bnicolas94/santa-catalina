import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const saldos = await prisma.saldoCaja.findMany()
  console.log('Saldos in DB:', JSON.stringify(saldos, null, 2))
  
  const movementsConceptos = await prisma.movimientoCaja.groupBy({
    by: ['concepto'],
    _count: true
  })
  console.log('Movements by Concepto:', JSON.stringify(movementsConceptos, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
