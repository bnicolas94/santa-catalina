import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PreviewRowResult } from "../preview/route";

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

        // En Prisma SQLite, la forma más limpia es hacer operaciones batch o secuencias
        // En PostgreSQL podríamos usar un gran transaction, pero con transacciones grandes SQLite bloquea
        for (const row of validRows) {
            try {
                await prisma.$transaction(async (tx) => {
                    let finalClientId = row.clientMatch.clienteId;

                    // 1. Crear cliente si es nuevo
                    if (row.clientMatch.isNew || !finalClientId) {
                        const newClient = await tx.cliente.create({
                            data: {
                                nombreComercial: row.clientMatch.proposedData.nombreComercial,
                                contactoTelefono: row.clientMatch.proposedData.contactoTelefono || null,
                                zona: "C", // Zona por defecto que puede editarse después
                            },
                        });
                        finalClientId = newClient.id;
                    }

                    // 2. Crear Pedido y sus Detalles
                    const totalUnidades = row.orderMatch.detalles.reduce((acc, d) => acc + d.cantidad, 0);

                    const { original } = row;

                    await tx.pedido.create({
                        data: {
                            clienteId: finalClientId,
                            fechaPedido: new Date(original.fecha), // Suponemos que ya viene en formato válido YYYY-MM-DD
                            fechaEntrega: new Date(original.fecha), // A futuro esto podría diferir
                            estado: "confirmado",
                            esRetiro: original.direccion?.toLowerCase().includes("retira") || false,
                            totalUnidades,
                            totalImporte: 0, // Se recalculará después o se actualizará en background
                            detalles: {
                                create: row.orderMatch.detalles.map(d => ({
                                    presentacionId: d.presentacionId,
                                    cantidad: d.cantidad,
                                    precioUnitario: 0, // En la migración histórica no es vital, se usa para pedidos nuevos
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
