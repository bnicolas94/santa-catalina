import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PreviewLocalRowResult } from "../preview/route";

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

        const { rows }: { rows: PreviewLocalRowResult[] } = await req.json();

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
        }

        // Filtrar solo los verdes y amarillos
        const validRows = rows.filter((r) => r.status !== "rojo");
        if (validRows.length === 0) {
            return NextResponse.json({ error: "No hay filas válidas para importar" }, { status: 400 });
        }

        // Buscar o crear el cliente "Ventas Mostrador"
        let clienteLocal = await prisma.cliente.findFirst({
            where: { nombreComercial: "Ventas Mostrador" }
        });

        if (!clienteLocal) {
            clienteLocal = await prisma.cliente.create({
                data: {
                    nombreComercial: "Ventas Mostrador",
                    activo: true,
                    zona: "Local",
                    segmento: "Mostrador"
                }
            });
        }

        // Preparar la creación de pedidos en una transacción
        const results = await prisma.$transaction(async (tx) => {
            let pedidosCreados = 0;

            for (const row of validRows) {
                if (!row.presentacionId || !row.paquetes) continue;

                // Forma de pago (normalizar)
                let medioPago = "efectivo";
                const fp = row.original.formaPago?.toLowerCase() || "";
                if (fp.includes("trans")) medioPago = "transferencia";
                else if (fp.includes("tarj")) medioPago = "tarjeta";

                // Crear pedido directamente como ENTREGADO y RETIRO
                await tx.pedido.create({
                    data: {
                        fechaPedido: new Date(row.original.fechaPedido),
                        fechaEntrega: new Date(row.original.fechaPedido), // Entregado en el momento
                        estado: "entregado",
                        esRetiro: true,
                        medioPago: medioPago,
                        totalUnidades: row.original.cantidad, // sándwiches
                        totalPacks: row.paquetes,
                        totalImporte: row.original.precio,
                        clienteId: clienteLocal!.id,
                        detalles: {
                            create: [{
                                cantidad: row.paquetes,
                                precioUnitario: row.precioUnitario,
                                presentacionId: row.presentacionId,
                                observaciones: `Venta Mostrador Original: ${row.original.cliente}`,
                            }]
                        }
                    }
                });

                pedidosCreados++;
            }

            return { pedidosCreados };
        });

        return NextResponse.json({
            success: true,
            message: `Se importaron exitosamente ${results.pedidosCreados} ventas de mostrador.`,
            creados: results.pedidosCreados
        });

    } catch (error: any) {
        console.error("Error confirmando ventas locales:", error);
        return NextResponse.json({ error: "Error interno al confirmar", details: error.message }, { status: 500 });
    }
}
