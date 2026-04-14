import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const cats = await prisma.categoriaGasto.findMany()
    console.log('Categorías de Gasto:', JSON.stringify(cats, null, 2))
    
    // Check if there are liquidaciones
    const liqs = await prisma.liquidacionSueldo.findMany({ take: 1 })
    console.log('Liquidación ejemplo:', JSON.stringify(liqs, null, 2))
    
    // Check if there are mantenimientos
    const mant = await prisma.mantenimientoVehiculo.count()
    console.log('Cantidad de Mantenimientos:', mant)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
