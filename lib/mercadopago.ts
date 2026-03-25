export interface MPPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  transaction_details?: {
    net_received_amount: number;
    total_paid_amount: number;
  };
  fee_details?: Array<{
    amount: number;
    fee_payer: string;
    type: string;
  }>;
  payment_method_id: string;
  payment_type_id: string;
  description: string;
  date_created: string;
  date_approved?: string;
  external_reference?: string;
}

export async function getPayment(paymentId: string | number): Promise<MPPaymentResponse | null> {
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  if (!MP_ACCESS_TOKEN) {
    console.error("MP_ACCESS_TOKEN no está configurado en las variables de entorno.");
    return null;
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`Error al obtener pago de Mercado Pago. Status: ${response.status}`);
      return null;
    }

    const data: MPPaymentResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error validando el pago con Mercado Pago:", error);
    return null;
  }
}
