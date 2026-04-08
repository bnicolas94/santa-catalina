const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    // 1. Local Gutierrez (tipo LOCAL)
    await prisma.$executeRaw`UPDATE ubicaciones SET caja_deposito_id = 'caja_fuerte_local', concepto_deposito = 'Depósito en Caja Fuerte Local', habilitar_deposito = true WHERE tipo = 'LOCAL'`;

    // 2. Central / Villa Elisa (tipo FABRICA)
    await prisma.$executeRaw`UPDATE ubicaciones SET caja_deposito_id = 'caja_fuerte_oficina', concepto_deposito = 'Depósito en Caja Fuerte Oficina', habilitar_deposito = true WHERE tipo = 'FABRICA'`;

    console.log('Raw seeding completed successfully')
}

main().catch(console.error).finally(() => prisma.$disconnect())
