const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const draft = await prisma.liquidacionSueldo.findFirst({
    where: { empleado: { nombre: 'German' }, estado: 'borrador' }
  });
  
  if (draft) {
    const desglose = [...draft.desglose];
    
    // 1. Restore Monday (index 0) valorFeriado
    // It is currently -14376. It should be 10244.
    desglose[0].valorFeriado = 10244;
    
    // 2. Fix Saturday (index 5)
    // It is currently "No Pagar" (multiplicadorJornal: 0, valorDiaBase: 0, valorFeriado: 26084).
    // The user wants it to be a full day: multiplicadorJornal: 1, valorDiaBase: 40976.
    // Wait, the user wants Saturday to sum exactly 61464. 40976 + 20488 = 61464.
    desglose[5].multiplicadorJornal = 1;
    desglose[5].valorDiaBase = 40976;
    desglose[5].valorFeriado = 20488; // 61464 - 40976 = 20488
    
    await prisma.liquidacionSueldo.update({
      where: { id: draft.id },
      data: {
        desglose: desglose,
        totalNeto: 153010
      }
    });
    
    console.log("Fixed German's draft!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
