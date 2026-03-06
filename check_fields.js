const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('EMPLEADO_FIELDS_START');
// Usamos un dmmf o simplemente miramos un objeto vacío o intentamos un findFirst
async function run() {
    const emp = await prisma.empleado.findFirst();
    console.log(Object.keys(emp || {}));
    console.log('EMPLEADO_FIELDS_END');
    await prisma.$disconnect();
}
run();
