import { NextResponse } from 'next/server'

export async function POST() {
    return NextResponse.json({ error: 'La planificación de rutas del ERP fue deshabilitada. Consultá los repartos del Google Sheet.' }, { status: 410 })
}
