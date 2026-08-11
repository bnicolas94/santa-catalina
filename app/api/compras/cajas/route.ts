import { NextResponse } from 'next/server'
import { CAJAS_COMPRA } from '@/lib/compras/validacion'

// Listado mínimo para seleccionar el origen de un pago desde Compras.
// No expone operaciones de ajuste de caja.
export async function GET() {
    return NextResponse.json(CAJAS_COMPRA.map(tipo => ({ tipo })))
}
