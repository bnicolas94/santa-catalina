const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    // Buscar todos los préstamos activos
    const prestamosActivos = await prisma.prestamoEmpleado.findMany({
        where: { estado: 'activo' },
        include: {
            cuotas: true,
            empleado: { select: { nombre: true, apellido: true } }
        }
    })

    console.log(`Encontrados ${prestamosActivos.length} préstamos activos.`)
    let corregidos = 0

    for (const prestamo of prestamosActivos) {
        const pendientes = prestamo.cuotas.filter(c => c.estado === 'pendiente').length
        const total = prestamo.cuotas.length

        if (pendientes === 0 && total > 0) {
            console.log(`✅ ${prestamo.empleado.nombre} ${prestamo.empleado.apellido} - Préstamo $${prestamo.montoTotal} (${prestamo.observaciones || 'Sin obs.'}) → ${total} cuotas, todas pagadas. Marcando como SALDADO.`)
            await prisma.prestamoEmpleado.update({
                where: { id: prestamo.id },
                data: { estado: 'saldado' }
            })
            corregidos++
        }
    }

    console.log(`\nResultado: ${corregidos} préstamos corregidos de ${prestamosActivos.length} activos.`)
}

main().finally(() => prisma.$disconnect())
