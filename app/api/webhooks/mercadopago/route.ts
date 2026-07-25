import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPayment } from "@/lib/mercadopago";
import { CajaService } from "@/lib/services/caja.service";
import { validateMercadoPagoSignature } from "@/lib/mercadopago-webhook";

export async function POST(req: Request) {
  try {
    let body: {
      type?: string;
      action?: string;
      data?: { id?: string | number };
    } = {};
    const textBody = await req.text();
    
    if (textBody) {
        try {
            body = JSON.parse(textBody);
        } catch {
            console.warn("[MercadoPago Webhook] Body no es JSON válido o está vacío");
        }
    }

    const url = new URL(req.url);
    const queryTopic = url.searchParams.get('topic');
    const queryId = url.searchParams.get('id') || url.searchParams.get('data.id');

    const topic = body.type || body.action || queryTopic;
    const paymentId = body?.data?.id || queryId;

    // Verificamos si la solicitud es una notificación de pago (v1 IPN o Webhook)
    if ((topic === "payment" || topic === "payment.created") && paymentId) {
      const signedDataId = queryId || String(paymentId);
      const signatureValidation = validateMercadoPagoSignature(req, signedDataId);
      if (!signatureValidation.valid) {
        console.warn(`[MercadoPago Webhook] Solicitud rechazada: ${signatureValidation.error}`);
        return NextResponse.json(
          { error: signatureValidation.error },
          { status: signatureValidation.status }
        );
      }
      
      console.log(`[MercadoPago Webhook] Recibido pago ID: ${paymentId}`);

      const paymentInfo = await getPayment(paymentId);
      
      if (!paymentInfo) {
        return NextResponse.json({ error: "No se pudo obtener la información del pago desde MP" }, { status: 400 });
      }

      const mpIdString = paymentInfo.id.toString();
      
      // Procesar parámetros de montos
      const montoBruto = paymentInfo.transaction_amount || 0;
      const montoNeto = paymentInfo.transaction_details?.net_received_amount ?? montoBruto;
      const comision = paymentInfo.fee_details?.reduce(
        (acc: number, fee: { amount?: number }) => acc + (fee.amount || 0),
        0
      ) || 0;

      // Intentar obtener el nombre del pagador
      const p = paymentInfo.payer;
      const payerName = (p?.first_name || p?.last_name) 
        ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
        : (p?.email ? p.email.split('@')[0] : 'Cliente MP');
      
      const shortDesc = paymentInfo.description || "Cobro Mercado Pago";
      const displayDesc = `[${payerName}] ${shortDesc}`;

      // Usamos una transacción para mantener consistencia 
      await prisma.$transaction(async (tx) => {
        // Hacemos upsert del movimiento Mercado Pago
        const movimientoMP = await tx.movimientoMercadoPago.upsert({
          where: { mpId: mpIdString },
          update: {
            estado: paymentInfo.status,
            montoNeto: montoNeto,
            comisionMp: comision,
            fechaAprobacionMp: paymentInfo.date_approved ? new Date(paymentInfo.date_approved) : null
          },
          create: {
            mpId: mpIdString,
            tipo: montoBruto >= 0 ? "ingreso" : "egreso",
            montoBruto: montoBruto,
            montoNeto: montoNeto,
            comisionMp: comision,
            metodoPago: `${paymentInfo.payment_type_id}-${paymentInfo.payment_method_id}`,
            estado: paymentInfo.status,
            fechaCreacionMp: new Date(paymentInfo.date_created),
            fechaAprobacionMp: paymentInfo.date_approved ? new Date(paymentInfo.date_approved) : null,
            descripcion: displayDesc,
            referenciaExterna: paymentInfo.external_reference
          }
        });

        // Verificamos si ya está entrelazado con MovimientoCaja, si no, lo sumamos al detectar que fue "approved"
        if (paymentInfo.status === "approved" && !movimientoMP.movimientoCajaId) {
          const cajaMp = await CajaService.createMovimientoEnTx(tx, {
            tipo: 'ingreso',
            concepto: displayDesc,
            monto: montoNeto,
            medioPago: 'transferencia',
            cajaOrigen: 'mercado_pago',
            descripcion: `PAGO #${paymentInfo.id} | ${payerName}`,
            fecha: paymentInfo.date_approved ? new Date(paymentInfo.date_approved) : new Date(),
          });

          // Conectamos el registro MP con la Caja
          await tx.movimientoMercadoPago.update({
            where: { id: movimientoMP.id },
            data: { movimientoCajaId: cajaMp.id }
          });
          
          console.log(`[MercadoPago Webhook] Pago ${mpIdString} registrado y acreditado en Caja Mercado Pago (${montoNeto}).`);
        } else if (movimientoMP.movimientoCajaId && paymentInfo.status !== "approved") {
          // Si el pago antes estaba aprobado y ahora fue devuelto/chargeback u otro estado, habría que revertir
          // pero típicamente requiera lógica adicional que dejaremos para operaciones manuales o ampliaciones
          console.warn(`[MercadoPago Webhook] El pago ${mpIdString} cambió su estado a ${paymentInfo.status} pero ya estaba en caja.`);
        }
      });
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Notificación ignorada", receivedType: body.type });
  } catch (error: unknown) {
    console.error("Error procesando Webhook de Mercado Pago:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
