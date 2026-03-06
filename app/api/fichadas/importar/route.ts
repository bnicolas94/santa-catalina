import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// POST /api/fichadas/importar — Procesa carga masiva de fichadas
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { registros } = body
        // Se espera un array: [{ codigoBiometrico: "123", fechaHora: "2023-10-01T08:00:00", tipo: "entrada" }, ...]

        if (!registros || !Array.isArray(registros)) {
            return NextResponse.json({ error: 'Formato inválido. Se espera un array de registros.' }, { status: 400 })
        }

        let importados = 0
        let errores = []

        // Obtener todos los empleados con código biométrico para mapear rápido
        const empleados = await prisma.empleado.findMany({
            where: { codigoBiometrico: { not: null } },
            select: { id: true, codigoBiometrico: true }
        })

        // Normalizamos los códigos al crear el mapa: "00011" -> "11"
        const mapEmpleados = new Map(empleados.map(e => {
            const raw = e.codigoBiometrico || ""
            const normalized = raw.replace(/^0+/, '')
            return [normalized, e.id]
        }))

        for (const reg of registros) {
            // Normalizamos también el código que viene en el registro
            const regRaw = reg.codigoBiometrico?.toString() || ""
            const regNormalized = regRaw.replace(/^0+/, '')

            const empleadoId = mapEmpleados.get(regNormalized)

            if (!empleadoId) {
                errores.push(`No se encontró empleado con código biométrico: ${regRaw} (Normalizado: ${regNormalized})`)
                continue
            }

            try {
                await prisma.fichadaEmpleado.create({
                    data: {
                        empleadoId,
                        fechaHora: new Date(reg.fechaHora),
                        tipo: reg.tipo.toLowerCase(),
                        origen: 'importado'
                    }
                })
                importados++
            } catch (err: any) {
                errores.push(`Error al insertar registro para empleado ${empleadoId}: ${err.message}`)
            }
        }

        return NextResponse.json({
            success: true,
            mensaje: `Se importaron ${importados} fichadas.`,
            errores: errores.length > 0 ? errores : undefined
        }, { status: 200 })

    } catch (error) {
        console.error('Error importing fichadas:', error)
        return NextResponse.json({ error: 'Error al importar fichadas' }, { status: 500 })
    }
}
