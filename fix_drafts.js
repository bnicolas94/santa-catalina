const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const desiredTotals = {
  "Sabrina": 212205,
  "Melisa": 262728,
  "Alejandra": 204882,
  "Yaqueline": 207149,
  "Santiago": 255986, // Santiago Diaz
  "Priscila": 186941,
  "Valentina Diaz": 279568, // Diaz
  "Valentina Contreras": 260765, // Contreras
  "Valentin": 286301,
  "Karen": 276197,
  "Selene": 227568,
  "German": 153010,
  "Norma": 392753,
  "Celeste": 415328,
  "Jeremias": 216702,
  "Daniel": 316012,
  "Nicolas": 617760
};

async function main() {
  const drafts = await prisma.liquidacionSueldo.findMany({
    where: { estado: 'borrador' },
    include: { empleado: true }
  });

  for (const draft of drafts) {
    let nameKey = draft.empleado.nombre;
    if (draft.empleado.nombre === 'Valentina') {
      nameKey = `Valentina ${draft.empleado.apellido}`;
    }
    
    // Some fuzzy matching
    let desiredTotal = desiredTotals[nameKey];
    if (!desiredTotal) {
      for (const k of Object.keys(desiredTotals)) {
        if (draft.empleado.nombre.includes(k) || k.includes(draft.empleado.nombre)) {
          desiredTotal = desiredTotals[k];
          break;
        }
      }
    }

    if (desiredTotal) {
      let currentTotalNeto = draft.totalNeto;
      
      // Calculate difference
      let diff = desiredTotal - currentTotalNeto;
      
      console.log(`Updating ${draft.empleado.nombre} ${draft.empleado.apellido}. Current: ${currentTotalNeto}, Desired: ${desiredTotal}, Diff: ${diff}`);
      
      if (diff !== 0 && draft.desglose && Array.isArray(draft.desglose)) {
        // Find a day to put the difference in
        // Let's put it in the first day's valorDiaBase or just add a new field to desglose or modify valorFeriado directly
        const desglose = [...draft.desglose];
        
        // Find feriado to adjust, or just the first item
        let feriadoIdx = desglose.findIndex(d => d.esFeriado);
        if (feriadoIdx >= 0) {
           desglose[feriadoIdx].valorFeriado = (desglose[feriadoIdx].valorFeriado || 0) + diff;
        } else if (desglose.length > 0) {
           desglose[0].valorDiaBase = (desglose[0].valorDiaBase || 0) + diff;
        }
        
        await prisma.liquidacionSueldo.update({
          where: { id: draft.id },
          data: { 
            totalNeto: desiredTotal,
            desglose: desglose
          }
        });
        console.log(`  -> Updated successfully in DB.`);
      } else {
        console.log(`  -> No difference or no desglose, skipping.`);
      }
    } else {
      console.log(`No desired total found for ${draft.empleado.nombre} ${draft.empleado.apellido}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
