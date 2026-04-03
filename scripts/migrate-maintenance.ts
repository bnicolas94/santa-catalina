import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrate() {
    console.log('--- Iniciando Migración de Mantenimientos a Gastos Operativos ---')
    
    // 1. Buscar o crear Categoría "Mantenimiento Vehículo"
    let cat = await prisma.categoriaGasto.findUnique({ where: { nombre: 'Mantenimiento de Vehículo' } })
    if (!cat) {
        cat = await prisma.categoriaGasto.create({
            data: { nombre: 'Mantenimiento de Vehículo', descripcion: 'Gastos de mantenimiento preventivo y correctivo de la flota', color: '#f44336' }
        })
        console.log('Categoría creada: Mantenimiento de Vehículo')
    }

    // 2. Buscar una ubicación por defecto (FABRICA)
    const fabrica = await prisma.ubicacion.findFirst({ where: { tipo: 'FABRICA' } })
    const ubicacionId = fabrica?.id || ''

    // 3. Obtener mantenimientos
    const mantenimientos = await prisma.mantenimientoVehiculo.findMany()
    console.log(`Encontrados ${mantenimientos.length} registros para migrar.`)

    let migrados = 0
    for (const m of mantenimientos) {
        // Verificar si ya existe el gasto (evitar duplicados si se corre de nuevo)
        // Usamos la descripción y fecha como llave rústica
        const d = new Date(m.fecha)
        const existing = await prisma.gastoOperativo.findFirst({
            where: {
                fecha: d,
                monto: m.costo,
                vehiculoId: m.vehiculoId,
                descripcion: { contains: m.descripcion }
            }
        })

        if (!existing) {
            await prisma.gastoOperativo.create({
                data: {
                    fecha: d,
                    monto: m.costo,
                    descripcion: `[MIGRA] ${m.tipo.toUpperCase()}: ${m.descripcion}${m.taller ? ' - Taller: ' + m.taller : ''}`,
                    categoriaId: cat.id,
                    ubicacionId: ubicacionId || null,
                    vehiculoId: m.vehiculoId,
                    kmVehiculo: m.kilometraje,
                    taller: m.taller,
                    recurrente: false
                }
            })
            migrados++
        }
    }

    console.log(`Migración completada: ${migrados} registros migrados.`)
    await prisma.$disconnect()
}

migrate()
