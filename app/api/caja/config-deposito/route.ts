import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs/promises'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'caja-depositos.json')

async function readConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8')
        return JSON.parse(data)
    } catch (error) {
        console.error('Error reading caja config:', error)
        return {}
    }
}

async function writeConfig(config: any) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

// GET: Obtener la configuración de depósito según la ubicación del usuario o todas si es ADMIN
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const config = await readConfig()
        const userUbicacionTipo = (session?.user as any)?.ubicacionTipo || 'LOCAL'
        const userRol = (session?.user as any)?.rol

        if (userRol === 'ADMIN') {
            return NextResponse.json(config)
        }

        return NextResponse.json(config[userUbicacionTipo] || { habilitarDeposito: false })
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
    }
}

// POST: Actualizar configuración (Solo ADMIN)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if ((session?.user as any)?.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const body = await req.json()
        await writeConfig(body)

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
    }
}
