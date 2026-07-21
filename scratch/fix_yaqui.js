const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const horasManuales = {
    "Yaqueline": 15.5
};

async function fix() {
    const empleados = await prisma.empleado.findMany();

    let count = 0;
    for (const [nombreKey, horas] of Object.entries(horasManuales)) {
        const emp = empleados.find(e => {
            const nombreCompleto = `${e.nombre} ${e.apellido || ''}`.toLowerCase().trim();
            return nombreCompleto.includes(nombreKey.toLowerCase());
        });

        if (!emp) continue;

        const liq = await prisma.liquidacionSueldo.findFirst({
            where: { empleadoId: emp.id },
            orderBy: { fechaGeneracion: 'desc' }
        });

        if (liq) {
            const valorHora = emp.valorHoraNormal || (emp.sueldoBaseMensual / 160);
            const valorHoraExtra = valorHora * (1 + (emp.porcentajeHoraExtra / 100));
            const nuevoMonto = horas * valorHoraExtra;
            const diffMonto = nuevoMonto - (liq.montoHorasExtras || 0);

            await prisma.liquidacionSueldo.update({
                where: { id: liq.id },
                data: { 
                    horasExtras: horas,
                    montoHorasExtras: nuevoMonto,
                    totalNeto: (liq.totalNeto || 0) + diffMonto
                }
            });
            count++;
        }
    }

    console.log(`Actualizados ${count} empleados.`);
    await prisma.$disconnect();
}

fix().catch(console.error);
