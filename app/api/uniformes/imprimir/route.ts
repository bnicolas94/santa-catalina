import { NextResponse } from 'next/server'

// La impresión se realiza sobre una entrega ya registrada; nunca crea movimientos.
export async function POST() {
    return NextResponse.json(
        { error: 'Registrá la entrega primero y luego imprimí su comprobante.' },
        { status: 410 },
    )
}
