const { PrismaClient } = require('@prisma/client')
const { PayrollService } = require('../lib/services/payroll.service')
const prisma = new PrismaClient()

async function main() {
    const emp = await prisma.empleado.findFirst({ where: { nombre: { contains: 'Jeremias' } } })
    if (!emp) return console.log('No found')
    
    const fechaInicio = '2026-05-04'
    const fechaFin = '2026-05-10'
    
    try {
        const result = await PayrollService.calcularSueldoSemanal(emp.id, fechaInicio, fechaFin)
        console.log('Resultado:')
        console.log(`Días: ${result.diasTrabajados}`)
        console.log(`Horas Normales: ${result.horasNormales}`)
        console.log(`Sueldo Base: ${result.sueldoBase}`)
        console.log('Primer día:', JSON.stringify(result.desglosePorDia[0], null, 2))
    } catch (e) {
        console.error(e)
    }
}

main()
