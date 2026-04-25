const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
  const liqs = await prisma.liquidacionSueldo.findMany({
    where: { empleadoId: '2af65163-b464-4c87-81f8-b46693a2dc7e' },
    orderBy: { fechaGeneracion: 'desc' }
  })
  console.log(JSON.stringify(liqs.map(l => ({ id: l.id, periodo: l.periodo, estado: l.estado })), null, 2))
}

check().catch(e => console.error(e)).finally(() => prisma.$disconnect())
