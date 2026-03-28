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

        const { rows }: { rows: PreviewRowResult[] } = await req.json();

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: "Formato inválido. Se esperaba un array 'rows'." }, { status: 400 });
        }

        let createdCount = 0;
        const errors: any[] = [];

        // Validamos que se envíen solament las confirmadas (por ej: que no sean Rojas)
        const validRows = rows.filter(r => r.status !== "rojo");

        // Traer precios de todas las presentaciones para calcular totales
        const todasPresentaciones = await prisma.presentacion.findMany({
            select: { id: true, precioVenta: true }
        });
        const precioMap = new Map(todasPresentaciones.map(p => [p.id, p.precioVenta]));

        // En Prisma SQLite, la forma más limpia es hacer operaciones batch o secuencias
        // En PostgreSQL podríamos usar un gran transaction, pero con transacciones grandes SQLite bloquea
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

                    // 2. Calcular Totales y Crear Pedido
                    const detallesConPrecio = row.orderMatch.detalles.map(d => ({
                        ...d,
                        precioUnitario: precioMap.get(d.presentacionId) || 0
                    }));

                    const totalUnidades = detallesConPrecio.reduce((acc, d) => acc + d.cantidad, 0);
                    const totalImporte = detallesConPrecio.reduce((acc, d) => acc + (d.cantidad * d.precioUnitario), 0);

                    const { original } = row;

                    await tx.pedido.create({
                        data: {
                            clienteId: finalClientId,
                            fechaPedido: new Date(original.fecha),
                            fechaEntrega: new Date(original.fecha),
                            estado: "confirmado",
                            esRetiro: original.direccion?.toLowerCase().includes("retira") || false,
                            totalUnidades,
                            totalImporte,
                            detalles: {
                                create: detallesConPrecio.map(d => ({
                                    presentacionId: d.presentacionId,
                                    cantidad: d.cantidad,
                                    precioUnitario: d.precioUnitario,
                                    observaciones: d.observaciones,
                                }))
                            }
                        }
                    });
                });
                createdCount++;
            } catch (rowError: any) {
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
