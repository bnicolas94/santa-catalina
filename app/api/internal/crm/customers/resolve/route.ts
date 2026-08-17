import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { matchCustomersByPhone, phoneDigits } from '@/lib/crm/customerPhoneMatch'

export async function GET(request: NextRequest) {
    const phoneE164 = request.nextUrl.searchParams.get('phoneE164')?.trim() || ''
    if (phoneDigits(phoneE164).length < 8) {
        return NextResponse.json({ error: 'El teléfono no tiene un formato válido.' }, { status: 400 })
    }

    try {
        const customers = await prisma.cliente.findMany({
            where: { activo: true, contactoTelefono: { not: null } },
            select: {
                id: true,
                nombreComercial: true,
                contactoNombre: true,
                contactoTelefono: true,
                direccion: true,
                zona: true,
                localidad: true,
            },
        })
        const candidates = matchCustomersByPhone(phoneE164, customers).map(customer => ({
            id: customer.id,
            commercialName: customer.nombreComercial,
            contactName: customer.contactoNombre,
            phone: customer.contactoTelefono,
            address: customer.direccion,
            zone: customer.zona,
            locality: customer.localidad,
            matchQuality: customer.matchQuality,
        }))

        return NextResponse.json({ candidates }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        console.error('[CRM internal] No se pudo resolver el cliente:', error)
        return NextResponse.json({ error: 'No se pudo consultar clientes.' }, { status: 500 })
    }
}
