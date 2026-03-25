import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("live_mp") === "true") {
      const response = await fetch("https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=15", {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error("API MP failed");
      const data = await response.json();
      return NextResponse.json(data.results || []);
    }

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
