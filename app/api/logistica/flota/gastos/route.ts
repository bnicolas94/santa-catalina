import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'

// GET /api/logistica/flota/gastos?vehiculoId=...&mes=...&anio=...
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const vehiculoId = searchParams.get('vehiculoId')
        const mes = searchParams.get('mes')
        const anio = searchParams.get('anio')
        const fechaDesde = searchParams.get('fechaDesde')
        const fechaHasta = searchParams.get('fechaHasta')

        let whereClause: any = {
            vehiculoId: vehiculoId ? vehiculoId : { not: null } // Gastos que tengan un vehículo asignado
        }

        if (fechaDesde && fechaHasta) {
            whereClause.fecha = { gte: new Date(`${fechaDesde}T00:00:00.000Z`), lte: new Date(`${fechaHasta}T23:59:59.999Z`) }
        } else if (mes && anio) {
            const startOfMonth = new Date(parseInt(anio), parseInt(mes) - 1, 1)
            const endOfMonth = new Date(parseInt(anio), parseInt(mes), 0, 23, 59, 59, 999)
            whereClause.fecha = { gte: startOfMonth, lte: endOfMonth }
        }

        const gastos = await prisma.gastoOperativo.findMany({
            where: whereClause,
            orderBy: { fecha: 'desc' },
            include: { 
                categoria: true,
                vehiculo: { select: { patente: true, alias: true, marca: true, modelo: true } }
            },
        })

        return NextResponse.json(gastos)
    } catch (error) {
        console.error('Error fetching fleet gastos:', error)
        return NextResponse.json({ error: 'Error al obtener gastos de flota' }, { status: 500 })
    }
}

// POST /api/logistica/flota/gastos
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { fecha, monto, descripcion, categoriaId, vehiculoId, kmVehiculo, taller, cajaTipo, vencimientoVtv } = body

        if (!fecha || !monto || !categoriaId || !vehiculoId || !cajaTipo) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        // 1. Verificar saldo de caja
        const caja = await prisma.saldoCaja.findUnique({
            where: { tipo: cajaTipo }
        })

        if (!caja) {
            return NextResponse.json({ error: `La caja '${cajaTipo}' no existe` }, { status: 400 })
        }

        if (caja.saldo < parseFloat(monto)) {
            // Permitir saldo negativo o advertir? Generalmente se advierte pero permite si es necesario.
            // Para este caso, vamos a permitirlo pero registrar el movimiento.
        }

        // 2. Ejecutar transacción para asegurar integridad
        const result = await prisma.$transaction(async (tx) => {
            const numericMonto = Math.abs(parseFloat(monto))

            // Crear el Gasto Operativo
            const gasto = await tx.gastoOperativo.create({
                data: {
                    fecha: (() => {
                        if (!fecha) return new Date();
                        if (typeof fecha === 'string' && fecha.length === 10) {
                            const todayStr = new Date().toISOString().split('T')[0];
                            if (fecha === todayStr) return new Date();
                            return new Date(fecha + 'T12:00:00Z');
                        }
                        return new Date(fecha);
                    })(),
                    monto: numericMonto,
                    descripcion: descripcion || '',
                    categoriaId,
                    vehiculoId,
                    kmVehiculo: kmVehiculo ? parseInt(kmVehiculo) : null,
                    taller: taller || null,
                    recurrente: false,
                }
            })

            // Crear el Movimiento de Caja (Egreso) y actualizar saldo
            await CajaService.createMovimientoEnTx(tx, {
                tipo: 'egreso',
                concepto: `Gasto Flota: ${descripcion || 'S/D'}`,
                monto: numericMonto,
                medioPago: 'efectivo',
                cajaOrigen: cajaTipo,
                descripcion: `Vinculado a vehículo ${vehiculoId}`,
                gastoId: gasto.id,
                fecha: gasto.fecha,
            })

            // Actualizar el kilometraje actual del vehículo si se proporcionó uno mayor
            if (kmVehiculo) {
                const v = await tx.vehiculo.findUnique({ where: { id: vehiculoId } })
                const numericKm = parseInt(kmVehiculo)
                if (v && numericKm > v.kmActual) {
                    await tx.vehiculo.update({
                        where: { id: vehiculoId },
                        data: { kmActual: numericKm }
                    })
            }
            
            const categoria = await tx.categoriaGasto.findUnique({ where: { id: categoriaId } })

            // 3. Vincular con Recordatorio de Service si la categoría es "Service"
            if (categoria && categoria.nombre.toLowerCase() === 'service' && kmVehiculo) {
                const numericKm = parseInt(kmVehiculo)
                const nextServiceKm = numericKm + 10000
                
                // Buscar si ya existe un recordatorio de tipo Service para este vehículo
                const existingVenc = await tx.vencimientoVehiculo.findFirst({
                    where: { 
                        vehiculoId,
                        tipo: { equals: 'Service', mode: 'insensitive' }
                    }
                })

                if (existingVenc) {
                    await tx.vencimientoVehiculo.update({
                        where: { id: existingVenc.id },
                        data: {
                            kmVencimiento: nextServiceKm,
                            kmAviso: 2000,
                            fechaVencimiento: null, // Priorizar KM
                            notificado: false,
                            observaciones: `Actualizado automáticamente por gasto el ${new Date().toLocaleDateString()}`
                        }
                    })
                } else {
                    await tx.vencimientoVehiculo.create({
                        data: {
                            vehiculoId,
                            tipo: 'Service',
                            kmVencimiento: nextServiceKm,
                            kmAviso: 2000,
                            observaciones: 'Generado automáticamente por carga de gasto de Service'
                        }
                    })
                }
            }

            // 4. Vincular con Recordatorio de VTV si la categoría es "VTV"
            if (categoria && categoria.nombre.toLowerCase() === 'vtv' && vencimientoVtv) {
                const existingVenc = await tx.vencimientoVehiculo.findFirst({
                    where: { 
                        vehiculoId,
                        tipo: { equals: 'VTV', mode: 'insensitive' }
                    }
                })

                const obsVtv = `Realizada el ${new Date(fecha).toLocaleDateString()}. Prox. vencimiento: ${new Date(vencimientoVtv).toLocaleDateString()}`

                if (existingVenc) {
                    await tx.vencimientoVehiculo.update({
                        where: { id: existingVenc.id },
                        data: {
                            fechaVencimiento: new Date(vencimientoVtv),
                            kmVencimiento: null, // Priorizar Fecha
                            notificado: false,
                            observaciones: obsVtv
                        }
                    })
                } else {
                    await tx.vencimientoVehiculo.create({
                        data: {
                            vehiculoId,
                            tipo: 'VTV',
                            fechaVencimiento: new Date(vencimientoVtv),
                            observaciones: obsVtv
                        }
                    })
                }
            }

            return gasto
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error('Error creating fleet gasto:', error)
        return NextResponse.json({ error: 'Error al registrar el gasto de flota' }, { status: 500 })
    }
}
