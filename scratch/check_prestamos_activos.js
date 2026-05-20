const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const prestamosActivos = await prisma.prestamoEmpleado.findMany({
        where: { estado: 'activo' },
        include: {
            cuotas: { orderBy: { numeroCuota: 'asc' } },
            empleado: { select: { nombre: true, apellido: true } }
        }
    })

    console.log(`Total préstamos activos: ${prestamosActivos.length}\n`)

    for (const p of prestamosActivos) {
        const pagadas = p.cuotas.filter(c => c.estado === 'pagada').length
        const pendientes = p.cuotas.filter(c => c.estado === 'pendiente').length
        const total = p.cuotas.length
        const todosPagados = pendientes === 0 && total > 0

        console.log(`${todosPagados ? '❌ DEBERIA SER SALDADO' : '✅ OK (tiene pendientes)'} | ${p.empleado.nombre} ${p.empleado.apellido} - $${p.montoTotal} (${p.observaciones || '-'})`)
        console.log(`   Cuotas: ${pagadas}/${total} pagadas, ${pendientes} pendientes`)
        p.cuotas.forEach(c => {
            console.log(`     Cuota ${c.numeroCuota}: $${c.monto} - ${c.estado} ${c.liquidacionId ? '(liq: ' + c.liquidacionId.substring(0, 8) + ')' : ''}`)
        })
        console.log('')
    }
}

main().finally(() => prisma.$disconnect())
