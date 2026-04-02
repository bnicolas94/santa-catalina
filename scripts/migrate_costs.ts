import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Iniciando migración de costos históricos...')

    // 1. Obtener detalles de pedidos que no tienen costo histórico
    const detalles = await prisma.detallePedido.findMany({
        where: {
            costoUnitarioHistorico: null
        },
        include: {
            presentacion: {
                include: {
                    producto: {
                        include: {
                            fichasTecnicas: {
                                include: {
                                    insumo: true
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    console.log(`📊 Encontrados ${detalles.length} detalles para migrar.`)

    let migrados = 0
    let errores = 0

    for (const det of detalles) {
        try {
            let costoPorSandwich = 0
            for (const ft of det.presentacion.producto.fichasTecnicas) {
                costoPorSandwich += ft.cantidadPorUnidad * (ft.insumo.precioUnitario || 0)
            }

            // El costo es: costo por sandwich * unidades por presentación
            // Nota: No multiplicamos por cantidad de paquetes aquí porque el campo
            // 'costoUnitarioHistorico' debería guardar el costo de UNA presentación (paquete).
            const costoUnitarioRef = costoPorSandwich * det.presentacion.cantidad

            await prisma.detallePedido.update({
                where: { id: det.id },
                data: { costoUnitarioHistorico: costoUnitarioRef }
            })

            migrados++
            if (migrados % 50 === 0) console.log(`✅ Procesados ${migrados}...`)
            
        } catch (error) {
            console.error(`❌ Error migrando detalle ${det.id}:`, error)
            errores++
        }
    }

    console.log(`\n🎉 Migración finalizada!`)
    console.log(`✅ Exitosos: ${migrados}`)
    console.log(`❌ Errores: ${errores}`)
}

main()
    .catch((e) => {
        console.error('❌ Error fatal en migración:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
