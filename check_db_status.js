const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- Database Record Counts ---')
    try {
        const counts = {
            Empleado: await prisma.empleado.count(),
            MovimientoCaja: await prisma.movimientoCaja.count(),
            SaldoCaja: await prisma.saldoCaja.count(),
            AsignacionOperario: await prisma.asignacionOperario.count(),
            ConceptoProduccion: await prisma.conceptoProduccion.count(),
            Ubicacion: await prisma.ubicacion.count(),
            Pedido: await prisma.pedido.count(),
            GastoOperativo: await prisma.gastoOperativo.count(),
        }
        console.table(counts)
        
        const saldos = await prisma.saldoCaja.findMany()
        console.log('\n--- SaldoCaja RAW JSON ---')
        console.log(JSON.stringify(saldos, null, 2))
        
        const lastMovs = await prisma.movimientoCaja.findMany({ 
            take: 10, 
            orderBy: { fecha: 'desc' }
        })
        console.log('\n--- Recent Movimientos RAW JSON ---')
        console.log(JSON.stringify(lastMovs, null, 2))

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
