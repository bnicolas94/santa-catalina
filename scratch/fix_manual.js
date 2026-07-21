const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const horasManuales = {
    "Yaqueline": 12.5,
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
    // Buscar la liquidación más reciente de cada empleado
    const empleados = await prisma.empleado.findMany();

    let count = 0;
    for (const [nombreKey, horas] of Object.entries(horasManuales)) {
        // Encontrar empleado que coincida con el nombre
        const emp = empleados.find(e => {
            const nombreCompleto = `${e.nombre} ${e.apellido || ''}`.toLowerCase().trim();
            return nombreCompleto.includes(nombreKey.toLowerCase());
        });

        if (!emp) {
            console.log(`No se encontró empleado para: ${nombreKey}`);
            continue;
        }

        // Buscar su liquidación más reciente (asumimos que es la de esta semana 6/7 al 12/7)
        const liq = await prisma.liquidacionSueldo.findFirst({
            where: { empleadoId: emp.id },
            orderBy: { fechaGeneracion: 'desc' }
        });

        if (liq) {
            console.log(`Actualizando ${nombreKey} (Liquidacion ${liq.periodo}) a ${horas} horas extras.`);
            
            // Si quieres también ajustar el monto para que matemáticamente cierre con su valor de hora extra, 
            // calculamos el valor de la hora extra.
            const valorHora = emp.valorHoraNormal || (emp.sueldoBaseMensual / 160);
            const valorHoraExtra = valorHora * (1 + (emp.porcentajeHoraExtra / 100));
            const nuevoMonto = horas * valorHoraExtra;

            // Diferencia entre el monto nuevo y el que ya estaba
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
        } else {
            console.log(`No se encontró liquidación para: ${nombreKey}`);
        }
    }

    console.log(`Actualizados ${count} empleados.`);
    await prisma.$disconnect();
}

fix().catch(console.error);
