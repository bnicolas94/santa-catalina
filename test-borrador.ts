import { prisma } from './lib/prisma';

async function test() {
    const data = {
        empleadoId: 'some-emp-id', // I will use a real one
        periodo: 'Semana del 25/5/2026 al 31/5/2026',
        sueldoProporcional: 1000,
        horasNormales: 0,
        montoHorasNormales: 0,
        horasExtras: 0,
        montoHorasExtras: 0,
        horasFeriado: 0,
        montoHorasFeriado: 0,
        ajusteHorasExtras: 2,
        descuentosPrestamos: 0,
        totalNeto: 1000,
        estado: 'borrador',
        desglose: [{fecha: '2026-05-25', horasExtras: 1}]
    };
    
    // get a real emp id
    const emp = await prisma.empleado.findFirst();
    if (!emp) return console.log('no emp');
    data.empleadoId = emp.id;

    const b = await prisma.liquidacionSueldo.create({
        data
    });
    
    console.log("Created:", b);
    
    const retrieved = await prisma.liquidacionSueldo.findUnique({ where: { id: b.id } });
    console.log("Retrieved:", retrieved);
    
    await prisma.liquidacionSueldo.delete({ where: { id: b.id } });
}

test().catch(console.error);
