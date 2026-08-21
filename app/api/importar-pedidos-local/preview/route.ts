import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tienePermisoEnSesion } from "@/lib/auth/permisosSesion";

export interface ExcelLocalRow {
    rowId: number;
    fechaPedido: string;
    cliente: string;
    producto: string;
    cantidad: number;
    precio: number;
    formaPago: string;
}

export interface PreviewLocalRowResult {
    rowId: number;
    original: ExcelLocalRow;
    presentacionId: string | null;
    productoNombre: string | null;
    paquetes: number;
    precioUnitario: number;
    status: "verde" | "amarillo" | "rojo";
    errors: string[];
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

        const { rows }: { rows: ExcelLocalRow[] } = await req.json();

        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: "Formato inválido. Se esperaba un array 'rows'." }, { status: 400 });
        }

        // Obtener presentaciones activas
        const presentacionesDB = await prisma.presentacion.findMany({
            where: { activo: true },
            select: {
                id: true,
                cantidad: true,
                productoId: true,
                producto: { select: { id: true, codigoInterno: true, alias: true, nombre: true } },
            },
        });

        // Filtrar filas donde el cliente contenga "local"
        const localRows = rows.filter(r => r.cliente?.toLowerCase().includes("local"));

        const previewResults: PreviewLocalRowResult[] = localRows.map((row) => {
            const errors: string[] = [];
            let status: "verde" | "amarillo" | "rojo" = "verde";

            // Normalizar texto del producto
            const prodText = row.producto?.toLowerCase() || "";
            
            // Detectar producto base por alias
            let matchedProducto = null;
            if (prodText.includes("jamón") || prodText.includes("jamon") || prodText.includes("jyq")) {
                matchedProducto = presentacionesDB.find(p => p.producto.codigoInterno === "JQ")?.producto;
            } else if (prodText.includes("surtido") && prodText.includes("especial")) {
                matchedProducto = presentacionesDB.find(p => p.producto.codigoInterno === "ESP")?.producto;
            } else if (prodText.includes("surtido") && (prodText.includes("clásico") || prodText.includes("clasico"))) {
                matchedProducto = presentacionesDB.find(p => p.producto.codigoInterno === "CLA")?.producto;
            } else if (prodText.includes("personalizado")) {
                matchedProducto = presentacionesDB.find(p => p.producto.codigoInterno === "ELE")?.producto;
            } else {
                // Intento genérico por alias
                matchedProducto = presentacionesDB.find(p => {
                    if (!p.producto.alias) return false;
                    const aliases = p.producto.alias.split(",").map(a => a.trim().toLowerCase());
                    return aliases.some(a => prodText.includes(a));
                })?.producto;
            }

            let presentacionId = null;
            let productoNombre = null;
            let paquetes = 0;
            let precioUnitario = 0;

            if (!matchedProducto) {
                status = "rojo";
                errors.push(`No se pudo reconocer el producto: "${row.producto}"`);
            } else {
                // Determinar la presentación en base a la cantidad (que en el excel viene en unidades/sándwiches)
                // Ej. si Cantidad es 48, y el producto es JYQ, buscamos la presentación de JYQ que tenga cantidad 48.
                // Sin embargo, si la cantidad es 48, eso es 1 paquete de 48.
                // ¿Qué pasa si "Cantidad" es 96? Serían 2 paquetes de 48? O la presentación x48 es la estándar?
                // El excel dice: "Personalizado x24 (3 planchas)" -> Cantidad: 24
                // Esto indica que "Cantidad" es el total de unidades.
                // Buscamos si existe una presentación exacta para esa cantidad
                let presMatch = presentacionesDB.find(p => p.productoId === matchedProducto?.id && p.cantidad === row.cantidad);
                
                if (presMatch) {
                    presentacionId = presMatch.id;
                    productoNombre = `${matchedProducto.nombre} x${presMatch.cantidad}`;
                    paquetes = 1; // Si compró 48 y hay pres de 48, es 1 paquete
                } else {
                    // Si no hay match exacto, usamos la presentación por defecto (la más grande o común)
                    // Ej: compró 16 unidades, y hay presentación de 16, la usa.
                    // Si compró 96 unidades, usamos la presentación x48 y son 2 paquetes.
                    const presX48 = presentacionesDB.find(p => p.productoId === matchedProducto?.id && p.cantidad === 48);
                    const presX24 = presentacionesDB.find(p => p.productoId === matchedProducto?.id && p.cantidad === 24);
                    const presX16 = presentacionesDB.find(p => p.productoId === matchedProducto?.id && p.cantidad === 16);
                    const presX8 = presentacionesDB.find(p => p.productoId === matchedProducto?.id && p.cantidad === 8);
                    
                    const bestPres = presX48 || presX24 || presX16 || presX8;
                    
                    if (bestPres) {
                        presentacionId = bestPres.id;
                        productoNombre = `${matchedProducto.nombre} x${bestPres.cantidad}`;
                        paquetes = row.cantidad / bestPres.cantidad;
                        
                        if (!Number.isInteger(paquetes)) {
                            status = "amarillo";
                            errors.push(`La cantidad ${row.cantidad} no es un múltiplo exacto de la presentación x${bestPres.cantidad}.`);
                        }
                    } else {
                        status = "rojo";
                        errors.push(`No hay presentaciones activas para el producto ${matchedProducto.nombre}.`);
                    }
                }
                
                if (paquetes > 0) {
                    precioUnitario = row.precio / paquetes;
                }
            }

            let fechaValida = false;
            let parsedDate = new Date(row.fechaPedido);

            if (!isNaN(parsedDate.getTime())) {
                fechaValida = true;
            } else if (row.fechaPedido) {
                const parts = row.fechaPedido.trim().split(" ");
                const datePart = parts[0];
                const timePart = parts[1] || "00:00:00";
                
                if (datePart && datePart.includes("/")) {
                    const [d, m, y] = datePart.split("/");
                    if (d && m && y) {
                        const cleanTime = timePart.split(":").length === 2 ? `${timePart}:00` : timePart;
                        const isoStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${cleanTime}`;
                        parsedDate = new Date(isoStr);
                        if (!isNaN(parsedDate.getTime())) {
                            fechaValida = true;
                        }
                    }
                }
            }

            if (!fechaValida) {
                status = "rojo";
                errors.push("Fecha de pedido inválida.");
            } else {
                row.fechaPedido = parsedDate.toISOString();
            }

            return {
                rowId: row.rowId,
                original: row,
                presentacionId,
                productoNombre,
                paquetes,
                precioUnitario,
                status,
                errors,
            };
        });

        return NextResponse.json({
            success: true,
            totalOriginalRows: rows.length,
            totalFiltradosLocal: localRows.length,
            verdes: previewResults.filter((r) => r.status === "verde").length,
            amarillos: previewResults.filter((r) => r.status === "amarillo").length,
            rojos: previewResults.filter((r) => r.status === "rojo").length,
            results: previewResults,
        });

    } catch (error: any) {
        console.error("Error en preview importación local:", error);
        return NextResponse.json({ error: "Error procesando la preview", details: error.message }, { status: 500 });
    }
}
