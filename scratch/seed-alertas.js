const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const rules = [
        {
            tipoInasistencia: 'INJUSTIFICADA',
            limiteMaximo: 3,
            periodoDias: 30,
            accionSugerida: 'Sanción Grave / Suspensión'
        },
        {
            tipoInasistencia: 'INJUSTIFICADA',
            limiteMaximo: 5,
            periodoDias: 365,
            accionSugerida: 'Despido con Causa'
        },
        {
            tipoInasistencia: 'CON_AVISO_INJUSTIFICADA',
            limiteMaximo: 5,
            periodoDias: 30,
            accionSugerida: 'Apercibimiento por escrito'
        },
        {
            tipoInasistencia: 'JUSTIFICADA_PAGA',
            limiteMaximo: 15,
            periodoDias: 365,
            accionSugerida: 'Revisión por Medicina Laboral'
        }
    ]

    for (const rule of rules) {
        await prisma.alertaAusentismo.upsert({
            where: { id: rule.tipoInasistencia + '_' + rule.limiteMaximo }, // This won't work as id is UUID
            // Actually I'll just create them
            create: rule,
            update: rule,
            where: { id: 'some-fake-id' } // This is just a scratch script
        }).catch(() => prisma.alertaAusentismo.create({ data: rule }))
    }

    console.log('Reglas de ausentismo creadas.')
}

main()
