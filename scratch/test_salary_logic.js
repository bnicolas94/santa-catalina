const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const empleadoId = '2f915df7-9b7b-4e03-990c-b13dbe6b4ecf' // Jeremias
    const empleado = await prisma.empleado.findUnique({
        where: { id: empleadoId },
        include: { rolRel: true }
    })
    
    console.log(`Empleado: ${empleado.nombre}`)
    console.log(`rolRel:`, empleado.rolRel ? 'PRESENTE' : 'AUSENTE')
    
    let montoBase = 0
    let cicloStr = 'SEMANAL'
    
    if (empleado.jornal > 0) {
        montoBase = empleado.jornal
        cicloStr = empleado.cicloPago || 'SEMANAL'
    } else if (empleado.rolRel?.jornal) {
        montoBase = empleado.rolRel.jornal
        cicloStr = (empleado.rolRel).cicloPago || 'SEMANAL'
    }
    
    console.log(`montoBase: ${montoBase}, cicloStr: ${cicloStr}`)
}

main()
