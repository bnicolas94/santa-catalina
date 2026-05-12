const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const start = new Date('2026-05-04T00:00:00')
    const end = new Date('2026-05-10T23:59:59')
    
    console.log(`Buscando fichadas entre ${start.toISOString()} y ${end.toISOString()}`)
    
    const fichadas = await prisma.fichadaEmpleado.findMany({
        where: {
            fechaHora: {
                gte: start,
                lte: end
            }
        },
        include: {
            empleado: true
        },
        take: 10
    })
    
    console.log(`Encontradas ${fichadas.length} fichadas:`)
    fichadas.forEach(f => {
        console.log(`- [${f.empleado.nombre}] ${f.tipo}: ${f.fechaHora.toISOString()}`)
    })
}

main()
