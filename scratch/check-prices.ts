
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const eleProd = await prisma.producto.findFirst({ where: { codigoInterno: 'ELE' }, include: { presentaciones: true } })
  const preProd = await prisma.producto.findFirst({ where: { codigoInterno: 'PRE' }, include: { presentaciones: true } })
  
  if (eleProd) {
    console.log("--- ELEGIDOS ---")
    eleProd.presentaciones.sort((a,b) => a.cantidad - b.cantidad).forEach(p => {
      console.log(`x${p.cantidad}: $${p.precioVenta}`)
    })
  }

  if (preProd) {
    console.log("\n--- PREMIUM ---")
    preProd.presentaciones.sort((a,b) => a.cantidad - b.cantidad).forEach(p => {
      console.log(`x${p.cantidad}: $${p.precioVenta}`)
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
