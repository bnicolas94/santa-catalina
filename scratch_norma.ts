import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const emp = await prisma.empleado.findFirst({
        where: { nombre: { contains: 'Norma' } },
        include: { turno: true }
    });
    console.log(JSON.stringify(emp, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
