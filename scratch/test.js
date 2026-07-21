const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() { 
    const liq = await prisma.liquidacionSueldo.findFirst({ 
        where: { id: '0dcb43bb-c18a-4ab8-aeba-17962438a812' } 
    }); 
    console.log(JSON.stringify(liq, null, 2)); 
    
    // Also print how calculatedData was saved in desglose
    if (liq.desglose) {
        console.log("DESGLOSE HORAS PENDIENTES:", liq.desglose.horasPendientes);
    }
    
    await prisma.$disconnect(); 
} 
main().catch(console.error);
