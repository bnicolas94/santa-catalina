import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PreviewRowResult } from "../preview/route";
import { parseDireccion } from "@/lib/parsers/addressUtils";
import { geocodeAddress } from "@/lib/services/geocoding";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const user = session.user as any;
        if (user.rol !== "ADMIN" && user.rol !== "ADMIN_OPS") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { rows, medioPago } = await req.json();

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: "Formato inválido. Se esperaba un array 'rows'." }, { status: 400 });
        }

        let createdCount = 0;
        const errors: any[] = [];

        // Validamos que se envíen solament las confirmadas (por ej: que no sean Rojas)
        const validRows = rows.filter(r => r.status !== "rojo");

        // Traer precios de todas las presentaciones para calcular totales
        const todasPresentaciones = await prisma.presentacion.findMany({
            select: { id: true, precioVenta: true, cantidad: true, productoId: true }
        });
        const precioMap = new Map(todasPresentaciones.map(p => [p.id, p.precioVenta]));

        // --- LÓGICA ANTI-DUPLICADOS (Borrón y cuenta nueva por Cliente/Fecha) ---
        // Identificamos qué clientes y fechas estamos importando para limpiar lo previo
        const limpiezas = new Map<string, { fecha: Date, clientes: Set<string> }>();
        validRows.forEach(row => {
            const fStr = row.original.fecha; // Usamos el string original para agrupar
            const cid = row.clientMatch.clienteId;
            if (fStr && cid) {
                if (!limpiezas.has(fStr)) {
                    // Intentamos parsear la fecha de forma robusta
                    let fechaObj: Date;
                    if (fStr.includes('/')) {
                        const [d, m, y] = fStr.split('/');
                        fechaObj = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0));
                    } else {
                        fechaObj = new Date(fStr + 'T12:00:00.000Z');
                    }

                    if (!isNaN(fechaObj.getTime())) {
                        limpiezas.set(fStr, { 
                            fecha: fechaObj, 
                            clientes: new Set() 
                        });
                    }
                }
                const currentLimpieza = limpiezas.get(fStr);
                if (currentLimpieza && cid) {
                    currentLimpieza.clientes.add(cid);
                }
            }
        });

        // Ejecutamos las limpiezas
        for (const [_, data] of limpiezas) {
            const validCids = Array.from(data.clientes).filter(id => !!id);
            if (validCids.length > 0) {
                // Primero buscamos los IDs de los pedidos que vamos a borrar para limpiar sus relaciones manuales
                const pedidosExistentes = await prisma.pedido.findMany({
                    where: {
                        fechaEntrega: data.fecha,
                        clienteId: { in: validCids }
                    },
                    select: { id: true }
                });

                const idsABorrar = pedidosExistentes.map(p => p.id);

                if (idsABorrar.length > 0) {
                    await prisma.$transaction([
                        // Borramos entregas asociadas (que no tienen onDelete: Cascade)
                        prisma.entrega.deleteMany({ where: { pedidoId: { in: idsABorrar } } }),
                        // Borramos movimientos de caja asociados
                        prisma.movimientoCaja.deleteMany({ where: { pedidoId: { in: idsABorrar } } }),
                        // Los DetallesPedido se borran solos por el Cascade en el esquema
                        prisma.pedido.deleteMany({ where: { id: { in: idsABorrar } } })
                    ]);
                }
            }
        }
        // -----------------------------------------------------------------------

        // En Prisma SQLite, la forma más limpia es hacer operaciones batch o secuencias
        const newClientsCache = new Map<string, string>(); // Evita duplicar clientes nuevos en el mismo batch

        for (const row of validRows) {
            try {
                await prisma.$transaction(async (tx) => {
                    let finalClientId = row.clientMatch.clienteId;

                    const { calle, numero, full } = parseDireccion(
                        row.clientMatch.proposedData.direccion || null,
                        row.clientMatch.proposedData.localidad || null
                    );

                    // Geocoding data
                    let latitud: number | null = null;
                    let longitud: number | null = null;
                    const geocode = await geocodeAddress(calle, numero, row.clientMatch.proposedData.localidad || null);
                    if (geocode) {
                        latitud = geocode.lat;
                        longitud = geocode.lng;
                    }

                    // 1. Crear o Actualizar cliente
                    if (row.clientMatch.isNew || !finalClientId) {
                        const cacheKey = row.clientMatch.proposedData.nombreComercial.trim().toLowerCase();
                        if (newClientsCache.has(cacheKey)) {
                            finalClientId = newClientsCache.get(cacheKey)!;
                        } else {
                            const newClient = await tx.cliente.create({
                                data: {
                                    nombreComercial: row.clientMatch.proposedData.nombreComercial,
                                    contactoTelefono: row.clientMatch.proposedData.contactoTelefono || null,
                                    direccion: full || row.clientMatch.proposedData.direccion || null,
                                    calle,
                                    numero,
                                    localidad: row.clientMatch.proposedData.localidad || null,
                                    zona: "C",
                                    latitud,
                                    longitud
                                },
                            });
                            finalClientId = newClient.id;
                            newClientsCache.set(cacheKey, finalClientId);
                        }
                    } else if (finalClientId) {
                        const existing = await tx.cliente.findUnique({ where: { id: finalClientId } });
                        if (existing) {
                            const updateData: any = {};
                            if (!existing.direccion && row.clientMatch.proposedData.direccion) {
                                updateData.direccion = full || row.clientMatch.proposedData.direccion;
                                updateData.calle = calle;
                                updateData.numero = numero;
                                updateData.latitud = latitud;
                                updateData.longitud = longitud;
                            }
                            if (!existing.localidad && row.clientMatch.proposedData.localidad) {
                                updateData.localidad = row.clientMatch.proposedData.localidad;
                            }
                            if (!existing.contactoTelefono && row.clientMatch.proposedData.contactoTelefono) {
                                updateData.contactoTelefono = row.clientMatch.proposedData.contactoTelefono;
                            }
                            
                            if (Object.keys(updateData).length > 0) {
                                await tx.cliente.update({
                                    where: { id: finalClientId },
                                    data: updateData
                                });
                            }
                        }
                    }

                    // 2. Calcular Totales y Crear Pedido (Con lógica especial para precios de pack/volumen en Elegidos)
                    const detallesCrudos = row.orderMatch.detalles;
                    const detallesConPrecio: any[] = [];
                    
                    // Agrupamos por nroPack para calcular precios de volumen (especialmente para Elegidos)
                    const packsMap = new Map<number, { 
                        totalCantidadPack: number, 
                        items: any[],
                        totalesPorProducto: Map<string, number>
                    }>();

                    detallesCrudos.forEach((d: any) => {
                        const nPack = d.nroPack || 0;
                        if (!packsMap.has(nPack)) {
                            packsMap.set(nPack, { 
                                totalCantidadPack: 0, 
                                items: [],
                                totalesPorProducto: new Map()
                            });
                        }
                        
                        const pData = todasPresentaciones.find(p => p.id === d.presentacionId);
                        const cantSandwiches = d.cantidad * (pData?.cantidad || 0);
                        const prodId = pData?.productoId || 'unknown';

                        const packInfo = packsMap.get(nPack)!;
                        packInfo.totalCantidadPack += cantSandwiches;
                        
                        // Acumulamos cantidad por producto dentro del pack
                        const actualProdTotal = packInfo.totalesPorProducto.get(prodId) || 0;
                        packInfo.totalesPorProducto.set(prodId, actualProdTotal + cantSandwiches);
                        
                        packInfo.items.push({ ...d, cantSandwiches, productoId: prodId });
                    });

                    // 1. Obtener ID real de Elegidos para la lógica de precios
                    const eleProd = await tx.producto.findFirst({ where: { codigoInterno: 'ELE' } });
                    const eleId = eleProd?.id;
                    
                    let totalDescuentoPorEfectivo = 0;

                    for (const [nPack, data] of packsMap.entries()) {
                        // 1. Cálculo de descuento por efectivo para este bulto específico (BASADO EN TOTAL DEL BULTO: 48 o 24)
                        if ((medioPago || 'efectivo') === 'efectivo') {
                            if (data.totalCantidadPack >= 48) totalDescuentoPorEfectivo += 2000;
                            else if (data.totalCantidadPack >= 24) totalDescuentoPorEfectivo += 1000;
                        }

                        // 2. Cálculo de precios unitarios (BASADO EN TOTAL POR PRODUCTO EN EL BULTO)
                        for (const item of data.items) {
                            let precioUnitarioCalculado = precioMap.get(item.presentacionId) || 0;
                            
                            // LOGICA DE COMBOS: Si hay varias filas del mismo producto, buscamos el precio de volumen acumulado
                            const totalDelProductoEnPack = data.totalesPorProducto.get(item.productoId) || 0;
                            const presActual = todasPresentaciones.find(p => p.id === item.presentacionId);

                            // Aplicamos lógica de combo si es Elegido o si el total acumulado es mayor a la presentación actual
                            if (item.productoId === eleId || item.observaciones?.includes('ELE') || totalDelProductoEnPack > (presActual?.cantidad || 0)) {
                                const presEquivalent = todasPresentaciones.find(p => 
                                    p.productoId === item.productoId && p.cantidad === totalDelProductoEnPack
                                );
                                if (presEquivalent && presEquivalent.cantidad > 0) {
                                    // Calculamos el proporcional (PrecioCombo / CantidadDeUnidadesDelCombo) * CantidadDeLaPresentacionActual
                                    const unitarioCombo = (presEquivalent.precioVenta / presEquivalent.cantidad) * (presActual?.cantidad || 8);
                                    if (!isNaN(unitarioCombo)) {
                                        precioUnitarioCalculado = unitarioCombo;
                                    }
                                }
                            }

                            detallesConPrecio.push({
                                ...item,
                                precioUnitario: precioUnitarioCalculado
                            });
                        }
                    }

                    const totalUnidades = detallesConPrecio.reduce((acc, d) => {
                        const cantSub = (todasPresentaciones.find(p => p.id === d.presentacionId)?.cantidad || 0);
                        return acc + (d.cantidad * cantSub);
                    }, 0);
                    const totalImporteBruto = detallesConPrecio.reduce((acc, d) => acc + (d.cantidad * d.precioUnitario), 0);
                    const totalImporteNeto = Math.round(totalImporteBruto - totalDescuentoPorEfectivo);
                    
                    // Cálculo de bultos físicos (Packs)
                    const packsUnicos = new Set(detallesConPrecio.filter(d => d.nroPack !== undefined).map(d => d.nroPack));
                    const itemsSinPack = detallesConPrecio.filter(d => d.nroPack === undefined).length;
                    const totalPacks = packsUnicos.size + itemsSinPack;

                    const { original } = row;
                    const turnoMap: Record<string, string> = { 'MANANA': 'Mañana', 'SIESTA': 'Siesta', 'TARDE': 'Tarde' }

                    // Aseguramos una fecha válida (mediodía UTC para evitar desfase de timezone)
                    let fechaFinal = new Date(original.fecha + 'T12:00:00.000Z');
                    if (isNaN(fechaFinal.getTime())) fechaFinal = new Date();

                    await tx.pedido.create({
                        data: {
                            clienteId: finalClientId,
                            fechaPedido: fechaFinal,
                            fechaEntrega: fechaFinal,
                            estado: "confirmado",
                            medioPago: medioPago || 'efectivo',
                            turno: original.turno ? (turnoMap[original.turno] || original.turno) : null,
                            esRetiro: row.esRetiro || original.direccion?.toLowerCase().includes("retira") || false,
                            totalUnidades,
                            totalImporte: totalImporteNeto, // Redondeamos para evitar decimales de prorrateo
                            totalPacks: totalPacks as any,
                            detalles: {
                                create: detallesConPrecio.map(d => ({
                                    presentacionId: d.presentacionId,
                                    cantidad: d.cantidad,
                                    precioUnitario: Math.round(d.precioUnitario || 0),
                                    observaciones: d.observaciones,
                                    nroPack: d.nroPack ? parseInt(d.nroPack.toString()) : null,
                                }))
                            }
                        }
                    });
                });
                createdCount++;
            } catch (rowError: any) {
                console.error("Error al procesar fila de importación:", rowError);
                errors.push({
                    rowId: row.rowId,
                    error: rowError.message || "Error al crear el registro",
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `¡Importación completada! ${createdCount} registros creados.`,
            createdCount,
            errorsCount: errors.length,
            errors,
        });

    } catch (error: any) {
        console.error("Error confirmando importación:", error);
        return NextResponse.json({ error: "Error en la operación de base de datos", details: error.message }, { status: 500 });
    }
}
