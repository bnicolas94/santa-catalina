const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const emp = await prisma.empleado.findFirst({ where: { nombre: { contains: 'Alejandra' } } })
    if (!emp) return console.log('No found')
    
    // Reproduce the full calculation for Alejandra
    const fechaInicio = '2026-05-04'
    const fechaFin = '2026-05-10'
    
    const fichadas = await prisma.fichadaEmpleado.findMany({
        where: {
            empleadoId: emp.id,
            fechaHora: {
                gte: new Date(fechaInicio + 'T00:00:00Z'),
                lte: new Date(fechaFin + 'T23:59:59Z')
            }
        }
    })
    
    console.log(`Fichadas Alejandra: ${fichadas.length}`)
    fichadas.forEach(f => console.log(`- ${f.tipo}: ${f.fechaHora.toISOString()}`))
}

main()
