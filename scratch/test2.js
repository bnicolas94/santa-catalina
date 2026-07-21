const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() { 
    const liqs = await prisma.liquidacionSueldo.findMany({ where: { empleadoId: '016bd900-a7c5-4907-8eee-0073f235337e' } }); 
    liqs.forEach(l => console.log(l.periodo, l.horasExtras, l.montoHorasExtras)); 
    await prisma.$disconnect(); 
} 
main().catch(console.error);
