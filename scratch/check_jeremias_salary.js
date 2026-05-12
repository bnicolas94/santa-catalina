const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const emp = await prisma.empleado.findFirst({
        where: { nombre: { contains: 'Jeremias' } },
        include: { rolRel: true }
    })
    
    if (emp) {
        console.log(`Empleado: ${emp.nombre} ${emp.apellido}`)
        console.log(`Jornal: ${emp.jornal}`)
        console.log(`Sueldo Base Mensual: ${emp.sueldoBaseMensual}`)
        console.log(`Rol: ${emp.rolRel?.nombre}`)
        console.log(`Rol Jornal: ${emp.rolRel?.jornal}`)
    } else {
        console.log('No se encontró a Jeremias')
    }
}

main()
