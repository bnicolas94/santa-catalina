const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const emp = await prisma.empleado.findFirst({
        where: { nombre: { contains: 'Jeremias' } }
    })
    
    if (!emp) {
        console.log('No se encontró a Jeremias')
        return
    }
    
    console.log(`Fichadas de ${emp.nombre} para esta semana:`)
    const start = new Date('2026-05-04T00:00:00')
    const end = new Date('2026-05-10T23:59:59')
    
    const fichadas = await prisma.fichadaEmpleado.findMany({
        where: {
            empleadoId: emp.id,
            fechaHora: { gte: start, lte: end }
        },
        orderBy: { fechaHora: 'asc' }
    })
    
    fichadas.forEach(f => {
        console.log(`- ${f.tipo} (${f.origen}): ${f.fechaHora.toISOString()}`)
    })
}

main()
