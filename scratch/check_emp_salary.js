const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const emp = await prisma.empleado.findFirst({
        where: { nombre: { contains: 'Alejandra' } },
        include: { rolRel: true }
    })
    
    if (emp) {
        console.log(`Empleado: ${emp.nombre} ${emp.apellido}`)
        console.log(`Jornal: ${emp.jornal}`)
        console.log(`Sueldo Base Mensual: ${emp.sueldoBaseMensual}`)
        console.log(`Rol Jornal: ${emp.rolRel?.jornal}`)
    } else {
        console.log('No se encontró a Alejandra')
    }
}

main()
