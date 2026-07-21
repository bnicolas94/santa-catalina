const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const exactValues = {
  "Yaqueline": { "horasExtras": 13, "montoHorasExtras": 87568, "totalNeto": 301456 },
  "Valentina Diaz": { "horasExtras": 6.5, "montoHorasExtras": 43784, "totalNeto": 240832 },
  "Valentina Contreras": { "horasExtras": 6, "montoHorasExtras": 40416, "totalNeto": 176834 },
  "Valentin Castillo": { "horasExtras": 4.5, "montoHorasExtras": 30312, "totalNeto": 170098 },
  "Selene Soria": { "horasExtras": 8, "montoHorasExtras": 54920, "totalNeto": 255401 },
  "Rocio Dominguez": { "horasExtras": 5, "montoHorasExtras": 33680, "totalNeto": 139783 },
  "Priscila Gomez": { "horasExtras": 5, "montoHorasExtras": 33680, "totalNeto": 200413 },
  "Norma Escobar": { "horasExtras": 18.5, "montoHorasExtras": 167018, "totalNeto": 428863 },
  "Nicolas Busto": { "horasExtras": 2, "montoHorasExtras": 42238, "totalNeto": 685796 },
  "Micaela Altamirano": { "horasExtras": 13.5, "montoHorasExtras": 90936, "totalNeto": 301456 },
  "Melisa Sanchez": { "horasExtras": 4, "montoHorasExtras": 26944, "totalNeto": 254307 },
  "Karen Rios": { "horasExtras": 2, "montoHorasExtras": 13472, "totalNeto": 77470 },
  "German Vocila": { "horasExtras": 9.5, "montoHorasExtras": 90108, "totalNeto": 105964 },
  "Daniel Rivero": { "horasExtras": 7, "montoHorasExtras": 63196, "totalNeto": 279899 },
  "Celeste Ramirez": { "horasExtras": 15, "montoHorasExtras": 135420, "totalNeto": 433382 },
  "Brian Quiroz": { "horasExtras": 12.5, "montoHorasExtras": 84200, "totalNeto": 284616 }
};

async function restore() {
    const empleados = await prisma.empleado.findMany();

    let count = 0;
    for (const [nombreKey, data] of Object.entries(exactValues)) {
        const emp = empleados.find(e => {
            const nombreCompleto = `${e.nombre} ${e.apellido || ''}`.toLowerCase().trim();
            return nombreCompleto.includes(nombreKey.toLowerCase());
        });

        if (!emp) {
            console.log("No encontrado:", nombreKey);
            continue;
        }

        const liq = await prisma.liquidacionSueldo.findFirst({
            where: { empleadoId: emp.id },
            orderBy: { fechaGeneracion: 'desc' }
        });

        if (liq) {
            console.log(`Restaurando ${nombreKey}: hs=${data.horasExtras}, monto=${data.montoHorasExtras}, neto=${data.totalNeto}`);
            
            await prisma.liquidacionSueldo.update({
                where: { id: liq.id },
                data: { 
                    horasExtras: data.horasExtras,
                    montoHorasExtras: data.montoHorasExtras,
                    totalNeto: data.totalNeto
                }
            });
            count++;
        }
    }

    console.log(`Restaurados exactamente ${count} empleados a los valores de la imagen.`);
    await prisma.$disconnect();
}

restore().catch(console.error);
