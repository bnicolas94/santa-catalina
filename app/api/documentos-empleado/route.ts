import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')

        if (!empleadoId) {
            return NextResponse.json({ error: 'empleadoId es requerido' }, { status: 400 })
        }

        const documentos = await prisma.documentoEmpleado.findMany({
            where: { empleadoId },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(documentos)
    } catch (error) {
        console.error('Error fetching documentos:', error)
        return NextResponse.json({ error: 'Error al obtener documentos' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        
        const empleadoId = formData.get('empleadoId') as string
        const tipoDocumento = formData.get('tipoDocumento') as string
        const fechaVencimiento = formData.get('fechaVencimiento') as string | null
        const observaciones = formData.get('observaciones') as string | null
        const file = formData.get('file') as File | null

        if (!empleadoId || !tipoDocumento || !file) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (empleadoId, tipoDocumento, file)' }, { status: 400 })
        }

        // Leer el archivo como buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Limpiar el nombre del archivo y generar uno único
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')
        const uniqueFilename = `${uuidv4()}-${cleanFileName}`

        // Definir la ruta de destino (Opción A: local filesystem MVP)
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'docs', 'empleados', empleadoId)
        
        // Crear el directorio si no existe
        await mkdir(uploadDir, { recursive: true })

        // Escribir el archivo físicamente
        const filePath = join(uploadDir, uniqueFilename)
        await writeFile(filePath, buffer)

        // URL pública accesible
        const archivoUrl = `/uploads/docs/empleados/${empleadoId}/${uniqueFilename}`

        // Guardar en la DB
        const documento = await prisma.documentoEmpleado.create({
            data: {
                empleadoId,
                tipoDocumento,
                archivoUrl,
                fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
                observaciones: observaciones || null
            }
        })

        return NextResponse.json(documento, { status: 201 })
    } catch (error: any) {
        console.error('Error uploading document:', error)
        return NextResponse.json({ error: 'Error interno al subir el documento' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de documento requerido' }, { status: 400 })
        }

        // Aquí podríamos también borrar el archivo físico, pero como es RRHH, a veces es mejor
        // un soft delete o solo borrar la referencia. Por ahora, borramos el registro.
        await prisma.documentoEmpleado.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting document:', error)
        return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 })
    }
}
