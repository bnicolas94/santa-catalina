const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('PRISMA_MODELS_START');
console.log(Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
console.log('PRISMA_MODELS_END');
prisma.$disconnect();
