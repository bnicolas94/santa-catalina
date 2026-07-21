const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    const liquidaciones = await prisma.liquidacionSueldo.findMany({
        include: { empleado: true }
    });

    let fixedCount = 0;

    for (const liq of liquidaciones) {
        if (!liq.montoHorasExtras || liq.montoHorasExtras === 0) continue;

        const empleado = liq.empleado;
        const valorHora = empleado.valorHoraNormal || (empleado.sueldoBaseMensual / 160);
        const valorHoraExtra = valorHora * (1 + (empleado.porcentajeHoraExtra / 100));

        if (valorHoraExtra <= 0) continue;

        // Calcular la cantidad de horas correctas según el monto
        let horasEsperadas = liq.montoHorasExtras / valorHoraExtra;
        
        // Redondear a dos decimales
        horasEsperadas = Math.round(horasEsperadas * 100) / 100;

        // Si hay una diferencia apreciable (> 0.1 hora)
        if (Math.abs((liq.horasExtras || 0) - horasEsperadas) > 0.1) {
            console.log(`Fixing Liquidacion ${liq.id} for Employee ${empleado.nombre}. Old hours: ${liq.horasExtras}, New hours: ${horasEsperadas}`);
            
            await prisma.liquidacionSueldo.update({
                where: { id: liq.id },
                data: {
                    horasExtras: horasEsperadas
                }
            });
            fixedCount++;
        }
    }

    console.log(`Fixed ${fixedCount} records.`);
    await prisma.$disconnect();
}

fix().catch(console.error);
