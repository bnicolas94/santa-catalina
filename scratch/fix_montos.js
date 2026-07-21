const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const horasManuales = {
    "Yaqueline": 15.5, // The updated value
    "Valentin Castillo": 5,
    "Valentina Diaz": 6.5,
    "Valentina Contreras": 6,
    "Selene Soria": 8.5,
    "Rocio": 5,
    "Priscila": 5,
    "Norma": 21.5,
    "Nicolas": 4.5,
    "Micaela": 15.5,
    "Melisa": 4,
    "Maximiliano": 2,
    "Karen": 2.5,
    "German": 9.5,
    "Daniel": 7,
    "Celeste": 19,
    "Brian": 13
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
            let valorHoraExtra = 0;

            // Try to get valorExtra from desglose
            if (liq.desglose && Array.isArray(liq.desglose) && liq.desglose.length > 0) {
                const diaValido = liq.desglose.find(d => d.valorExtra > 0);
                if (diaValido) {
                    valorHoraExtra = diaValido.valorExtra;
                }
            }

            // Fallback to emp fields
            if (valorHoraExtra === 0) {
                const valorHora = emp.valorHoraNormal || (emp.sueldoBaseMensual / 160);
                valorHoraExtra = valorHora * (1 + (emp.porcentajeHoraExtra / 100));
            }

            const nuevoMonto = horas * valorHoraExtra;
            const diffMonto = nuevoMonto - (liq.montoHorasExtras || 0);

            console.log(`Fixing ${nombreKey}: horas=${horas}, valorExtra=${valorHoraExtra}, nuevoMonto=${nuevoMonto}, diff=${diffMonto}`);

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
