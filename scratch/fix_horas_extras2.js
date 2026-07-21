const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    const liquidaciones = await prisma.liquidacionSueldo.findMany();

    let fixedCount = 0;

    for (const liq of liquidaciones) {
        if (!liq.montoHorasExtras || liq.montoHorasExtras === 0) continue;

        let valorExtra = 0;
        if (liq.desglose && Array.isArray(liq.desglose)) {
            for (const d of liq.desglose) {
                if (d.valorExtra > 0) {
                    valorExtra = d.valorExtra;
                    break;
                }
            }
        }

        if (valorExtra > 0) {
            let horasEsperadas = liq.montoHorasExtras / valorExtra;
            horasEsperadas = Math.round(horasEsperadas * 100) / 100;

            if (Math.abs((liq.horasExtras || 0) - horasEsperadas) > 0.1) {
                console.log(`Fixing Liquidacion ${liq.id}. Old hours: ${liq.horasExtras}, New hours: ${horasEsperadas}`);
                await prisma.liquidacionSueldo.update({
                    where: { id: liq.id },
                    data: { horasExtras: horasEsperadas }
                });
                fixedCount++;
            }
        }
    }

    console.log(`Fixed ${fixedCount} records.`);
    await prisma.$disconnect();
}

fix().catch(console.error);
