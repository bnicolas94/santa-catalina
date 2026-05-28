import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const resolvedParams = await params
        const pathSegments = resolvedParams.path

        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse('Not Found', { status: 404 })
        }

        const uploadsDir = join(process.cwd(), 'public', 'uploads')
        const filePath = join(uploadsDir, ...pathSegments)

        // Prevent directory traversal attacks
        if (!filePath.startsWith(uploadsDir)) {
            return new NextResponse('Access Denied', { status: 403 })
        }

        if (!existsSync(filePath)) {
            return new NextResponse('File Not Found', { status: 404 })
        }

        const fileBuffer = await readFile(filePath)

        const ext = filePath.split('.').pop()?.toLowerCase() || ''
        let contentType = 'application/octet-stream'

        if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
        else if (ext === 'png') contentType = 'image/png'
        else if (ext === 'gif') contentType = 'image/gif'
        else if (ext === 'pdf') contentType = 'application/pdf'
        else if (ext === 'svg') contentType = 'image/svg+xml'
        else if (ext === 'txt') contentType = 'text/plain'

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch (error) {
        console.error('Error serving upload file:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
