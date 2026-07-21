const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() { 
    const liqs = await prisma.liquidacionSueldo.findMany({ include: { empleado: true } }); 
    liqs.forEach(l => { 
        if (l.horasExtras > 0 && l.horasExtras % 0.5 !== 0) {
            console.log(l.empleado.nombre, "Horas Extras:", l.horasExtras, "Monto Extras:", l.montoHorasExtras); 
        }
    }); 
    await prisma.$disconnect(); 
} 
main().catch(console.error);
