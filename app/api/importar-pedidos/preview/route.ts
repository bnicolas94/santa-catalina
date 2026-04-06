import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOrderText, ParseResult } from "@/lib/parsers/orderText";
import { matchClient, ClientMatchResult } from "@/lib/parsers/clientMatch";

// Tipo esperado del frontend
export interface ExcelRow {
    rowId: number; // Para identificar la fila en el UI
    fecha: string; // ISO String
    nombreCliente: string;
    pedidoTexto: string; // Ej: "24jyq 8hue"
    direccion?: string;
    localidad?: string;
    telefono?: string;
    turno?: "MANANA" | "SIESTA" | "TARDE";
}

export interface PreviewRowResult {
    rowId: number;
    original: ExcelRow;
    clientMatch: ClientMatchResult;
    orderMatch: ParseResult;
    status: "verde" | "amarillo" | "rojo";
    errors: string[];
}

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

        const { rows }: { rows: ExcelRow[] } = await req.json();

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: "Formato inválido. Se esperaba un array 'rows'." }, { status: 400 });
        }

        const [clientesDB, presentacionesDB] = await Promise.all([
            prisma.cliente.findMany({
                select: { id: true, nombreComercial: true, contactoTelefono: true },
            }),
            prisma.presentacion.findMany({
                where: { activo: true },
                select: {
                    id: true,
                    cantidad: true,
                    productoId: true,
                    producto: { select: { id: true, codigoInterno: true, alias: true } },
                },
            }),
        ]);

        const previewResults: PreviewRowResult[] = rows.map((row) => {
            const errors: string[] = [];

            // 1. Match de Cliente
            const clientMatch = matchClient(row.nombreCliente, row.telefono || null, row.direccion || null, row.localidad || null, clientesDB);

            // 2. Parseo de Pedido
            const orderMatch = parseOrderText(row.pedidoTexto, presentacionesDB as any);

            // 3. Determinar Status General de la Fila
            let status: "verde" | "amarillo" | "rojo" = "verde";

            if (!orderMatch.isFullyMatched) {
                // En el nuevo formato, las filas no matcheadas van a amarillo para carga manual
                status = "amarillo";
                errors.push(`Concepto no reconocido en: "${row.pedidoTexto}". Se cargará manualmente o revisar formato.`);
            } else if (orderMatch.detalles.length === 0) {
                status = "rojo";
                errors.push("No se pudo extraer ningún producto válido del pedido.");
            }

            if (clientMatch.confidence === "low") {
                status = status === "rojo" ? "rojo" : "amarillo";
                errors.push("Cliente nuevo. Se creará al confirmar.");
            } else if (clientMatch.confidence === "medium") {
                status = status === "rojo" ? "rojo" : "amarillo";
                errors.push("Baja confianza en coincidencia de cliente. Verificar.");
            }

            // Suavizamos el error de fecha a advertencia (amarillo)
            if (!row.fecha || isNaN(new Date(row.fecha).getTime())) {
                status = status === "rojo" ? "rojo" : "amarillo";
                errors.push("Fecha inválida.");
            }

            return {
                rowId: row.rowId,
                original: row,
                clientMatch,
                orderMatch,
                status,
                errors,
            };
        });

        return NextResponse.json({
            success: true,
            totalRows: rows.length,
            verdes: previewResults.filter((r) => r.status === "verde").length,
            amarillos: previewResults.filter((r) => r.status === "amarillo").length,
            rojos: previewResults.filter((r) => r.status === "rojo").length,
            results: previewResults,
        });

    } catch (error: any) {
        console.error("Error en preview importación:", error);
        return NextResponse.json({ error: "Error procesando la preview", details: error.message }, { status: 500 });
    }
}
