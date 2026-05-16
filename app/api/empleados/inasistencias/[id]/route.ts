import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id
        const contentType = request.headers.get('content-type') || ''
        let body: any = {}
        let file: File | null = null

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData()
            body = {
                empleadoId: formData.get('empleadoId'),
                fecha: formData.get('fecha'),
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

        const { tipo, motivo, tieneCertificado, observaciones, minutosRetraso } = body

        let archivoUrl = undefined
        if (file) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const uniqueFilename = `${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`
            const uploadDir = join(process.cwd(), 'public', 'uploads', 'inasistencias', body.empleadoId || 'unknown')
            await mkdir(uploadDir, { recursive: true })
            await writeFile(join(uploadDir, uniqueFilename), buffer)
            archivoUrl = `/uploads/inasistencias/${body.empleadoId || 'unknown'}/${uniqueFilename}`
        }

        const updated = await prisma.inasistencia.update({
            where: { id },
            data: {
                tipo,
                motivo,
                tieneCertificado: !!tieneCertificado,
                observaciones,
                minutosRetraso: minutosRetraso ? parseInt(String(minutosRetraso)) : null,
                ...(archivoUrl ? { archivoUrl } : {})
            }
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Error updating inasistencia:', error)
        return NextResponse.json({ error: 'Error al actualizar inasistencia' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id
        await prisma.inasistencia.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting inasistencia:', error)
        return NextResponse.json({ error: 'Error al eliminar inasistencia' }, { status: 500 })
    }
}
