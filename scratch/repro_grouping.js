const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const empleadoId = '2a6f16d0-f4c0-4e42-8707-781a8520a578' // Jeremias (I'll find his real ID)
    const emp = await prisma.empleado.findFirst({ where: { nombre: { contains: 'Jeremias' } } })
    if (!emp) return console.log('No found')
    
    const fechaInicio = '2026-05-04'
    const fechaFin = '2026-05-10'
    
    // Import the logic from payroll service (I'll just copy the core part)
    const fichadas = await prisma.fichadaEmpleado.findMany({
        where: {
            empleadoId: emp.id,
            fechaHora: {
                gte: new Date(fechaInicio + 'T00:00:00'),
                lte: new Date(fechaFin + 'T23:59:59')
            }
        }
    })
    
    console.log(`Fichadas encontradas: ${fichadas.length}`)
    
    // Agrupar logic
    const grupos = {}
    fichadas.forEach(f => {
        const d = new Date(f.fechaHora)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const fechaLocal = `${year}-${month}-${day}`
        if (!grupos[fechaLocal]) grupos[fechaLocal] = []
        grupos[fechaLocal].push(f)
    })
    
    console.log('Grupos por día:', Object.keys(grupos))
}

main()
