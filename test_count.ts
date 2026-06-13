import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
async function main() { 
    const c = await prisma.pedido.count({ 
        where: { 
            fechaEntrega: { gte: new Date('2026-06-13T00:00:00.000Z'), lte: new Date('2026-06-13T23:59:59.999Z') } 
        } 
    }); 
    console.log('Total del dia:', c); 
} 
main().finally(()=>prisma.$disconnect());
