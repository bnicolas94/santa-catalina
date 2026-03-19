import { prisma } from './lib/prisma';
async function main() {
    const conceptos = await prisma.conceptoCaja.findMany();
    console.log(JSON.stringify(conceptos, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
