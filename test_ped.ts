import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
async function main() { 
    const peds = await prisma.pedido.findMany({ 
        where: { 
            fechaEntrega: { gte: new Date('2026-06-13T00:00:00.000Z'), lte: new Date('2026-06-13T23:59:59.999Z') }, 
            esRetiro: false, 
            estado: 'confirmado', 
            turno: 'Mañana' 
        }, 
        include: { cliente: true } 
    }); 
    console.log(`Total DB: ${peds.length}`); 
    const filtrados = peds.filter(p => !p.cliente.direccion?.toLowerCase().includes('retira') && !p.cliente.zona?.toLowerCase().includes('retira')); 
    console.log(`Pasan el filtro 'retira': ${filtrados.length}`); 
    const excluidos = peds.filter(p => p.cliente.direccion?.toLowerCase().includes('retira') || p.cliente.zona?.toLowerCase().includes('retira')); 
    console.log('Excluidos por retira:', excluidos.map(d => ({id: d.id, cliente: d.cliente.nombreComercial, dir: d.cliente.direccion, zona: d.cliente.zona}))); 
} 
main().finally(()=>prisma.$disconnect());
