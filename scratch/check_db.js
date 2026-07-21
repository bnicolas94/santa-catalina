const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const liq = await prisma.liquidacionSueldo.findFirst({
        where: { empleadoId: '016bd900-a7c5-4907-8eee-0073f235337e' },
        orderBy: { fechaGeneracion: 'desc' }
    });
    console.log("Yaqueline liq:", JSON.stringify(liq, null, 2));

    const emp = await prisma.empleado.findUnique({
        where: { id: '016bd900-a7c5-4907-8eee-0073f235337e' }
    });
    console.log("Yaqueline emp val:", emp.valorHoraNormal, emp.sueldoBaseMensual, emp.porcentajeHoraExtra);
    
    await prisma.$disconnect();
}
check().catch(console.error);
