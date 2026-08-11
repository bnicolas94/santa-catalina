// VERSION_IDENTIFIER: 2026-03-13_V3_CLEAN
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calcularConsumosProduccion, registrarConsumoInicial } from '@/lib/services/produccion-insumos'
import fs from 'fs'
import path from 'path'

function logError(error: any) {
    try {
        const logPath = path.join(process.cwd(), 'lotes_error.log')
        const logEntry = `[${new Date().toISOString()}] Error: ${error?.message || error}\nStack: ${error?.stack}\n\n`
        fs.appendFileSync(logPath, logEntry)
    } catch (e) {
        console.error('Failed to log to file:', e)
    }
}

// GET /api/lotes
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para ver producción' }, { status: 403 })
        }
        const lotes = await prisma.lote.findMany({
            orderBy: { fechaProduccion: 'desc' },
            include: {
                producto: { include: { presentaciones: true } },
                coordinador: { select: { id: true, nombre: true } },
                ubicacion: { select: { id: true, nombre: true } },
                _count: { select: { detallePedidos: true } },
                movimientosProducto: {
                    where: { tipo: 'produccion', signo: 'entrada' },
                    select: { presentacionId: true, cantidad: true }
                }
            },
        })
        return NextResponse.json(lotes)
    } catch (error) {
        console.error('Error fetching lotes:', error)
        return NextResponse.json({ error: 'Error al obtener lotes' }, { status: 500 })
    }
}

// POST /api/lotes
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para registrar producción' }, { status: 403 })
        }

        const body = await request.json()
        const { productoId, presentacionId, fechaProduccion, unidadesProducidas, empleadosRonda, coordinadorId, estado, ubicacionId } = body

        if (!productoId || !fechaProduccion || unidadesProducidas === undefined || !ubicacionId) {
            return NextResponse.json({ error: 'Producto, fecha, unidades y ubicación son requeridos' }, { status: 400 })
        }

        const qtyPaquetes = Number(unidadesProducidas)
        if (!Number.isInteger(qtyPaquetes) || qtyPaquetes <= 0) {
            return NextResponse.json({ error: 'La cantidad de paquetes debe ser un entero mayor a cero' }, { status: 400 })
        }

        // Operaciones de fecha únicas
        const [year, month, day] = fechaProduccion.split('-').map(Number)
        const fecha = new Date(Date.UTC(year, month - 1, day))
        const yyyymmdd = fechaProduccion.replace(/-/g, '')

        const startOfProdDay = new Date(fecha)
        startOfProdDay.setHours(0, 0, 0, 0)
        const endOfProdDay = new Date(fecha)
        endOfProdDay.setHours(23, 59, 59, 999)

        const producto = await prisma.producto.findUnique({ where: { id: productoId } })
        if (!producto) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
        }

        const presentacionSeleccionada = presentacionId
            ? await prisma.presentacion.findFirst({ where: { id: presentacionId, productoId } })
            : await prisma.presentacion.findFirst({ where: { productoId }, orderBy: { cantidad: 'desc' } })
        if (presentacionId && !presentacionSeleccionada) {
            return NextResponse.json({ error: 'La presentación seleccionada no corresponde al producto' }, { status: 400 })
        }
        if (!presentacionSeleccionada) {
            return NextResponse.json({ error: 'El producto no tiene una presentación configurada' }, { status: 400 })
        }

        const fichasT = await prisma.fichaTecnica.findMany({
            where: { productoId },
            select: {
                insumoId: true,
                cantidadPorUnidad: true,
                merma: true,
                tipoConsumo: true,
                presentacionId: true,
            },
        })
        if (fichasT.length === 0) {
            return NextResponse.json({ error: 'El producto no tiene una ficha técnica configurada' }, { status: 400 })
        }
        const consumosIniciales = calcularConsumosProduccion(
            fichasT,
            qtyPaquetes,
            presentacionSeleccionada.cantidad,
            presentacionSeleccionada.id,
        )

        // Buscar el número más alto existente para este producto+día para evitar colisiones
        const prefix = `SC-${yyyymmdd}-${producto.codigoInterno}-`
        const existingLotes = await prisma.lote.findMany({
            where: {
                id: { startsWith: prefix }
            },
            select: { id: true },
            orderBy: { id: 'desc' },
            take: 1
        })
        
        let nextNum = 1
        if (existingLotes.length > 0) {
            const lastId = existingLotes[0].id
            const lastNumStr = lastId.replace(prefix, '')
            const lastNum = parseInt(lastNumStr) || 0
            nextNum = lastNum + 1
        }

        const loteId = `${prefix}${String(nextNum).padStart(2, '0')}`
        // Obtener posicionamiento para el día
        const posicionamientosStr = await prisma.asignacionOperario.findMany({
            where: {
                fecha: { gte: startOfProdDay, lte: endOfProdDay },
                ubicacionId,
            },
            include: {
                empleado: { select: { nombre: true, apellido: true } },
                concepto: { select: { nombre: true } }
            }
        }).then((asigs: any[]) => asigs.map(a => `${a.empleado?.nombre || 'S/N'} (${a.concepto?.nombre || 'S/C'})`).join(', '))

        const lote = await prisma.$transaction(async (tx) => {
            const nuevoLote = await tx.lote.create({
                data: {
                    id: loteId,
                    fechaProduccion: fecha,
                    horaInicio: new Date(),
                    unidadesPlanificadas: qtyPaquetes,
                    unidadesProducidas: qtyPaquetes,
                    empleadosRonda: parseInt(empleadosRonda) || 1,
                    estado: estado || 'en_camara',
                    productoId,
                    coordinadorId: coordinadorId || null,
                    ubicacionId,
                    distribucion: [{ presentacionId: presentacionSeleccionada.id, cantidad: qtyPaquetes }],
                },
                include: {
                    producto: true,
                    coordinador: { select: { id: true, nombre: true } },
                },
            })

            await registrarConsumoInicial(tx, {
                loteId,
                ubicacionId,
                consumos: consumosIniciales,
                personal: posicionamientosStr || undefined,
            })

            if ((estado || 'en_camara') !== 'en_produccion') {
                const presentacion = presentacionSeleccionada
                if (presentacion) {
                    await tx.stockProducto.upsert({
                        where: { productoId_presentacionId_ubicacionId: { productoId, presentacionId: presentacion.id, ubicacionId } },
                        create: { productoId, presentacionId: presentacion.id, ubicacionId, cantidad: qtyPaquetes },
                        update: { cantidad: { increment: qtyPaquetes } },
                    })
                    await tx.movimientoProducto.create({
                        data: {
                            productoId,
                            presentacionId: presentacion.id,
                            tipo: 'produccion',
                            cantidad: qtyPaquetes,
                            ubicacionId,
                            signo: 'entrada',
                            observaciones: `Producción Lote ${loteId}`,
                            loteId,
                        },
                    })
                }
            }

            return nuevoLote
        }, {
            // El inicio descuenta varios insumos y registra cada movimiento dentro
            // de la misma transacción. En bases remotas puede superar los 5 segundos
            // predeterminados de Prisma sin que exista un error de datos.
            maxWait: 10000,
            timeout: 60000,
        })

        return NextResponse.json(lote, { status: 201 })
    } catch (error: any) {
        logError(error)
        console.error('Error creating lote:', error)
        const esTimeoutTransaccion = String(error?.message || '').includes('Transaction not found')
            || String(error?.message || '').includes('Transaction API error')
        const message = esTimeoutTransaccion
            ? 'La operación demoró más de lo esperado y fue revertida. Volvé a intentar.'
            : error?.message || 'Error al crear lote'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
