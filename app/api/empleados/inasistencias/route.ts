import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SancionService } from '@/lib/services/sancion.service'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const desde = searchParams.get('desde')
        const hasta = searchParams.get('hasta')

        const where: any = {}
        if (empleadoId) where.empleadoId = empleadoId
        if (desde || hasta) {
            where.fecha = {}
            if (desde) where.fecha.gte = new Date(desde)
            if (hasta) where.fecha.lte = new Date(hasta)
        }

        const inasistencias = await prisma.inasistencia.findMany({
            where,
            include: {
                empleado: {
                    select: {
                        nombre: true,
                        apellido: true,
                        rol: true
                    }
                }
            },
            orderBy: { fecha: 'desc' }
        })

        return NextResponse.json(inasistencias)
    } catch (error) {
        console.error('Error fetching inasistencias:', error)
        return NextResponse.json({ error: 'Error al obtener inasistencias' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const contentType = request.headers.get('content-type') || ''
        let body: any = {}
        let file: File | null = null

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData()
            body = {
                empleadoId: formData.get('empleadoId'),
                fecha: formData.get('fecha'),
                fechaHasta: formData.get('fechaHasta'),
                tipo: formData.get('tipo'),
                motivo: formData.get('motivo'),
                tieneCertificado: formData.get('tieneCertificado') === 'true',
                observaciones: formData.get('observaciones'),
                minutosRetraso: formData.get('minutosRetraso')
            }
            file = formData.get('file') as File | null
        } else {
            body = await request.json()
        }

        const { 
            empleadoId, 
            fecha, 
            fechaHasta, 
            tipo, 
            motivo, 
            tieneCertificado, 
            observaciones,
            minutosRetraso 
        } = body

        if (!empleadoId || !fecha || !tipo) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        let archivoUrl = null
        if (file) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const uniqueFilename = `${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`
            const uploadDir = join(process.cwd(), 'public', 'uploads', 'inasistencias', empleadoId)
            await mkdir(uploadDir, { recursive: true })
            await writeFile(join(uploadDir, uniqueFilename), buffer)
            archivoUrl = `/uploads/inasistencias/${empleadoId}/${uniqueFilename}`
        }

        const results = []
        const startDate = new Date(fecha)
        const endDate = fechaHasta ? new Date(fechaHasta) : startDate

        let current = new Date(startDate)
        while (current <= endDate) {
            const inasistencia = await prisma.inasistencia.create({
                data: {
                    empleadoId,
                    fecha: new Date(current),
                    tipo,
                    motivo,
                    tieneCertificado: !!tieneCertificado,
                    observaciones,
                    minutosRetraso: minutosRetraso ? parseInt(String(minutosRetraso)) : null,
                    archivoUrl: archivoUrl
                }
            })
            results.push(inasistencia)
            current.setDate(current.getDate() + 1)
        }

        try {
            await SancionService.checkAndApplyAlerts(empleadoId)
        } catch (alertaError) {
            console.error('Error al procesar alertas tras inasistencia:', alertaError)
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error('Error creating inasistencia(s):', error)
        return NextResponse.json({ error: 'Error al registrar inasistencia(s)' }, { status: 500 })
    }
}
