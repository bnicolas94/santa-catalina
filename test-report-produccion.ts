import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testReport() {
    console.log('🧪 Probando API de Reporte de Producción...')
    
    const now = new Date()
    const mes = now.getMonth() + 1
    const anio = now.getFullYear()

    const startOfMonth = new Date(anio, mes - 1, 1)
    const endOfMonth = new Date(anio, mes, 0, 23, 59, 59, 999)

    // Consultamos los lotes directamente en la DB para comparar
    const lotes = await prisma.lote.findMany({
        where: {
            fechaProduccion: { gte: startOfMonth, lte: endOfMonth },
            estado: { not: 'en_produccion' }
        },
        include: {
            producto: true
        }
    })

    let totalPaquetes = 0
    let totalPlanchas = 0
    let totalSanguchitos = 0

    for (const lote of lotes) {
        const planchasPorPaq = lote.producto.planchasPorPaquete || 6
        const planchas = lote.unidadesProducidas * planchasPorPaq
        const sanguchitos = planchas * 8

        totalPaquetes += lote.unidadesProducidas
        totalPlanchas += planchas
        totalSanguchitos += sanguchitos
    }

    console.log('--- Resultados Esperados (DB) ---')
    console.log(`Mens/Año: ${mes}/${anio}`)
    console.log(`Lotes procesados: ${lotes.length}`)
    console.log(`Total Paquetes: ${totalPaquetes}`)
    console.log(`Total Planchas: ${totalPlanchas}`)
    console.log(`Total Sanguchitos: ${totalSanguchitos}`)
    
    if (totalPaquetes > 0) {
        console.log('✅ Hay datos de producción para este mes.')
    } else {
        console.warn('⚠️ No se encontraron lotes cerrados/en cámara para este mes en la DB.')
    }
}

testReport()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e)
        prisma.$disconnect()
        process.exit(1)
    })
