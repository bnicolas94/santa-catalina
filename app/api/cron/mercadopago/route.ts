import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Permitir más tiempo de ejecución si Vercel/Railway lo soporta
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    
    // Verificación de seguridad simple: el cronjob debe ejecutarse con ?secret=COMPARTIDO
    if (secret !== process.env.MP_WEBHOOK_SECRET) {
       return NextResponse.json({ error: "No autorizado. Token incorrecto." }, { status: 401 });
    }

    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
       return NextResponse.json({ error: "Falta configuración de MP_ACCESS_TOKEN" }, { status: 500 });
    }

    // Traer los pagos de los últimos 2 días asegurando abarcar todo
    const apiUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=NOW-2DAYS&end_date=NOW&limit=100`;

    const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${mpToken}` },
        cache: 'no-store'
    });
    
    if (!response.ok) {
       throw new Error(`API de MP falló con el código histórico ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    // Identificar Egresos (salientes)
    const outgoing = results.filter((p: any) => {
        if (p.status !== "approved") return false;
        
        // Criterio 1: transferencias hacia afuera (retiros bancarios, envíos P2P)
        // En la API MP, las transferencias salientes figuran con monto positivo pero sin collector_id (o distinto)
        const isTransferOut = p.operation_type === "money_transfer" && !p.collector_id;
        
        // Criterio 2: si MP explícitamente reporta el monto bruto en negativo (algunos reembolsos o débitos)
        const isNegative = (p.transaction_amount || 0) < 0 || (p.transaction_details?.net_received_amount || 0) < 0;

        return isTransferOut || isNegative;
    });

    let addedCount = 0;
    const addedIds = [];

    // Procesar cada egreso detectado de más viejo a más nuevo
    for (const p of outgoing.reverse()) {
        const mpIdString = p.id.toString();
        
        // Verificar existencia previa
        const exists = await prisma.movimientoMercadoPago.findUnique({
             where: { mpId: mpIdString }
        });
        
        if (!exists) {
            // Calculamos el valor a descontar de forma absoluta (ya sabemos que es egreso)
            const bruto = Math.abs(p.transaction_amount || 0);
            const neto = Math.abs(p.transaction_details?.net_received_amount ?? bruto);
            const comision = p.fee_details?.reduce((acc: number, fee: any) => acc + fee.amount, 0) || 0;
            
            await prisma.$transaction(async (tx) => {
                 // 1. Crear registro en logs de MercadoPago
                 const movimientoMP = await tx.movimientoMercadoPago.create({
                    data: {
                        mpId: mpIdString,
                        tipo: "egreso",
                        montoBruto: bruto,
                        montoNeto: neto,
                        comisionMp: comision,
                        metodoPago: `${p.payment_type_id}-${p.payment_method_id}`,
                        estado: p.status,
                        fechaCreacionMp: new Date(p.date_created),
                        fechaAprobacionMp: p.date_approved ? new Date(p.date_approved) : null,
                        descripcion: p.description || "Egreso MP Automático / Transferencia",
                        referenciaExterna: p.external_reference
                    }
                 });

                 // 2. Insertarlo oficialmente en Movimientos de Caja física/virtual
                 const cajaMp = await tx.movimientoCaja.create({
                    data: {
                        fecha: p.date_approved ? new Date(p.date_approved) : new Date(p.date_created),
                        tipo: "egreso", // Tipo: Egreso
                        concepto: p.description || "Egreso MP Automático",
                        monto: neto, // Guardamos monto positivo (Caja front lo resta visualmente si es egreso)
                        medioPago: "mercado_pago",
                        cajaOrigen: "mercado_pago",
                        descripcion: `AUTO-RETIRO #${p.id} | MP`,
                    }
                 });

                 // Actualizar la relación 
                 await tx.movimientoMercadoPago.update({
                    where: { id: movimientoMP.id },
                    data: { movimientoCajaId: cajaMp.id }
                 });

                 // 3. Modificar el Saldo Total de la Caja Virtual "M.Pago"
                 await tx.saldoCaja.upsert({
                    where: { tipo: "mercado_pago" },
                    update: { saldo: { decrement: neto } },
                    create: { tipo: "mercado_pago", saldo: -neto }
                 });
            });
            addedCount++;
            addedIds.push(mpIdString);
            console.log(`[Cron MercadoPago] Egreso procesado automáticamente: ID ${mpIdString} descontando $${neto}`);
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: "Sincronización de egresos completada al 100%",
        scannedLast48hs: results.length,
        outgoingDetected: outgoing.length, 
        newlyAdded: addedCount,
        addedIds
    });
  } catch (error: any) {
      console.error("[Cron MercadoPago] Error crítico:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
