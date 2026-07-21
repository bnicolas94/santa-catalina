const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    const liquidaciones = await prisma.liquidacionSueldo.findMany();

    let fixedCount = 0;

    for (const liq of liquidaciones) {
        if (!liq.horasExtras) continue;

        // Redondear a la mitad más cercana (ej: 4.938 -> 5.0, 1.67 -> 1.5 o 2.0)
        // Math.round(x * 2) / 2 redondea al 0.5 más cercano
        const horasRedondeadas = Math.round(liq.horasExtras * 2) / 2;

        if (Math.abs(liq.horasExtras - horasRedondeadas) > 0.001) {
            console.log(`Fixing Liquidacion ${liq.id}. Old hours: ${liq.horasExtras}, New hours: ${horasRedondeadas}`);
            await prisma.liquidacionSueldo.update({
                where: { id: liq.id },
                data: { horasExtras: horasRedondeadas }
            });
            fixedCount++;
        }
    }

    console.log(`Fixed ${fixedCount} records.`);
    await prisma.$disconnect();
}

fix().catch(console.error);
