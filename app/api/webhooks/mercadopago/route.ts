import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPayment } from "@/lib/mercadopago";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Verificamos si la solicitud es una notificación de pago (v1 IPN o Webhook)
    if ((body.type === "payment" || body.action === "payment.created") && body.data && body.data.id) {
      const paymentId = body.data.id;
      
      console.log(`[MercadoPago Webhook] Recibido pago ID: ${paymentId}`);

      const paymentInfo = await getPayment(paymentId);
      
      if (!paymentInfo) {
        return NextResponse.json({ error: "No se pudo obtener la información del pago desde MP" }, { status: 400 });
      }

      const mpIdString = paymentInfo.id.toString();
      
      // Procesar parámetros de montos
      const montoBruto = paymentInfo.transaction_amount || 0;
      const montoNeto = paymentInfo.transaction_details?.net_received_amount ?? montoBruto;
      const comision = paymentInfo.fee_details?.reduce((acc, fee) => acc + fee.amount, 0) || 0;

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
            descripcion: paymentInfo.description || "Ingreso por Mercado Pago",
            referenciaExterna: paymentInfo.external_reference
          }
        });

        // Verificamos si ya está entrelazado con MovimientoCaja, si no, lo sumamos al detectar que fue "approved"
        if (paymentInfo.status === "approved" && !movimientoMP.movimientoCajaId) {
          const cajaMp = await tx.movimientoCaja.create({
            data: {
              fecha: paymentInfo.date_approved ? new Date(paymentInfo.date_approved) : new Date(),
              tipo: "ingreso",
              concepto: paymentInfo.description || "Cobro Mercado Pago",
              monto: montoNeto, // Impactamos el neto en la caja
              medioPago: "mercado_pago",
              cajaOrigen: "mercado_pago",
              descripcion: `PAGO #${paymentInfo.id} | MP`,
            }
          });

          // Conectamos el registro MP con la Caja
          await tx.movimientoMercadoPago.update({
            where: { id: movimientoMP.id },
            data: { movimientoCajaId: cajaMp.id }
          });

          // Actualizamos el saldo acumulado en la tabla SaldoCaja
          await tx.saldoCaja.upsert({
            where: { tipo: "mercado_pago" },
            update: {
              saldo: { increment: montoNeto }
            },
            create: {
              tipo: "mercado_pago",
              saldo: montoNeto
            }
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
  } catch (error: any) {
    console.error("Error procesando Webhook de Mercado Pago:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
