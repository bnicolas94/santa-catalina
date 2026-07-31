import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

type Tabla = { table_name: string }

function jsonReplacer(_key: string, value: unknown) {
    return typeof value === 'bigint' ? value.toString() : value
}

function quoteIdentifier(identifier: string) {
    return `"${identifier.replaceAll('"', '""')}"`
}

async function main() {
    console.log('Iniciando backup completo de la base de datos...')

    const backupDir = path.join(process.cwd(), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_pre_migracion_${timestamp}.json`
    const filePath = path.join(backupDir, fileName)

    // Consultar las tablas reales evita depender del cliente generado, que puede
    // contener columnas de una migración que todavía no fue aplicada.
    const tablas = await prisma.$queryRaw<Tabla[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `

    if (tablas.length === 0) throw new Error('La base no contiene tablas públicas para respaldar')

    const datos: Record<string, unknown[]> = {}
    let totalRegistros = 0

    for (const { table_name: tabla } of tablas) {
        const nombreSeguro = quoteIdentifier(tabla)
        const filas = await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM ${nombreSeguro}`)
        datos[tabla] = filas
        totalRegistros += filas.length
        console.log(`Respaldada ${tabla}: ${filas.length} registro(s)`)
    }

    const contenido = {
        _metadata: {
            formato: 2,
            creadoEn: new Date().toISOString(),
            tablas: tablas.length,
            registros: totalRegistros
        },
        datos
    }

    fs.writeFileSync(filePath, JSON.stringify(contenido, jsonReplacer, 2), { flag: 'wx' })

    // Verificación inmediata: el archivo debe poder leerse y conservar todos los conteos.
    const verificacion = JSON.parse(fs.readFileSync(filePath, 'utf8')) as typeof contenido
    if (verificacion._metadata.tablas !== tablas.length || verificacion._metadata.registros !== totalRegistros) {
        throw new Error('El archivo generado no superó la verificación de integridad')
    }

    const size = fs.statSync(filePath).size
    if (size === 0) throw new Error('El archivo de backup quedó vacío')

    console.log('\nBackup completado y verificado.')
    console.log(`Archivo: ${filePath}`)
    console.log(`Tablas: ${tablas.length}`)
    console.log(`Registros: ${totalRegistros}`)
    console.log(`Tamaño: ${size} bytes`)
}

main()
    .catch((error) => {
        console.error('Error fatal en backup:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
