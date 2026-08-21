import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOrderText, ParseResult } from "@/lib/parsers/orderText";
import { matchClient, ClientMatchResult } from "@/lib/parsers/clientMatch";
import { tienePermisoEnSesion } from "@/lib/auth/permisosSesion";

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
    esRetiro: boolean;
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        if (!tienePermisoEnSesion(session, 'permisoPedidos')) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
                    producto: { select: { id: true, codigoInterno: true, alias: true, nombre: true, planchasPorPaquete: true } },
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

            // IGNORAR FILAS DE CONTROL INTERNO (Cliente == "local")
            if (row.nombreCliente.trim().toLowerCase() === "local") {
                status = "rojo";
                errors.push("Fila de control interno ('local'). Se ignora.");
            } else if (!orderMatch.isFullyMatched) {
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
                orderMatch: {
                    ...orderMatch,
                    detalles: orderMatch.detalles.map(d => {
                        const pres = presentacionesDB.find(p => p.id === d.presentacionId);
                        return { 
                            ...d, 
                            productoNombre: pres?.producto.nombre || "Producto" 
                        };
                    })
                },
                status,
                errors,
                esRetiro: !!orderMatch.esRetiro || 
                    (!row.direccion && !clientMatch.proposedData.direccion) ||
                    !!(row.direccion && (row.direccion.toLowerCase().includes('retira') || row.direccion.toLowerCase().includes('local'))) ||
                    !!(clientMatch.proposedData.direccion && (clientMatch.proposedData.direccion.toLowerCase().includes('retira') || clientMatch.proposedData.direccion.toLowerCase().includes('local')))
            };
        });

        // Calcular total de planchas de Elegidos (ELE) agrupado por turno y sabor
        let totalPlanchasElegidos = 0;
        const planchasPorTurno: Record<string, Record<string, number>> = {};

        previewResults.forEach(res => {
            res.orderMatch.detalles.forEach(det => {
                const pres = presentacionesDB.find(p => p.id === det.presentacionId);
                if (pres?.producto.codigoInterno === 'ELE') {
                    const planchasPorPaquete = pres.producto.planchasPorPaquete || 6;
                    const unidadesPorPlancha = 48 / planchasPorPaquete; // Asumimos 48 como base de pack
                    const planchas = (det.cantidad * pres.cantidad) / unidadesPorPlancha;
                    
                    totalPlanchasElegidos += planchas;

                    const turno = res.original.turno || 'Sin Turno';
                    const normalizedTurno = turno.charAt(0).toUpperCase() + turno.slice(1).toLowerCase(); // Mañana, Siesta, Tarde...
                    
                    const sabor = (det.observaciones || 'Surtido').trim().toUpperCase();

                    if (!planchasPorTurno[normalizedTurno]) {
                        planchasPorTurno[normalizedTurno] = {};
                    }
                    planchasPorTurno[normalizedTurno][sabor] = (planchasPorTurno[normalizedTurno][sabor] || 0) + planchas;
                }
            });
        });

        // Redondear los valores por turno a 1 decimal
        for (const t in planchasPorTurno) {
            for (const s in planchasPorTurno[t]) {
                planchasPorTurno[t][s] = Math.round(planchasPorTurno[t][s] * 10) / 10;
            }
        }

        return NextResponse.json({
            success: true,
            totalRows: rows.length,
            verdes: previewResults.filter((r) => r.status === "verde").length,
            amarillos: previewResults.filter((r) => r.status === "amarillo").length,
            rojos: previewResults.filter((r) => r.status === "rojo").length,
            totalPlanchasElegidos: Math.round(totalPlanchasElegidos * 10) / 10,
            planchasPorTurno,
            results: previewResults,
        });

    } catch (error: any) {
        console.error("Error en preview importación:", error);
        return NextResponse.json({ error: "Error procesando la preview", details: error.message }, { status: 500 });
    }
}
