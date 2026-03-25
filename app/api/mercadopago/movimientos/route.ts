import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const movimientos = await prisma.movimientoMercadoPago.findMany({
      orderBy: { createdAt: "desc" },
      take: 100, // Limitamos a los últimos 100 por performance 
      include: {
        movimientoCaja: true // Incluye el registro de caja si existe
      }
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    console.error("Error obteniendo movimientos de Mercado Pago:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
