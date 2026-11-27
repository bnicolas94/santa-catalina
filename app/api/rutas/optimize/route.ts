import { NextResponse } from 'next/server'

export async function POST() {
    return NextResponse.json({ error: 'La optimización de rutas del ERP fue deshabilitada.' }, { status: 410 })
}
