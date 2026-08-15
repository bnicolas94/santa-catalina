import fs from 'node:fs'
import path from 'node:path'
import { Client, type QueryResultRow } from 'pg'

type Tabla = QueryResultRow & { table_schema: string; table_name: string }
type Columna = QueryResultRow & {
    table_schema: string
    table_name: string
    column_name: string
    ordinal_position: number
    data_type: string
    udt_schema: string
    udt_name: string
    is_nullable: string
    column_default: string | null
}

function jsonReplacer(_key: string, value: unknown) {
    return typeof value === 'bigint' ? value.toString() : value
}

function quoteIdentifier(identifier: string) {
    return `"${identifier.replaceAll('"', '""')}"`
}

function backupKey(schema: string, table: string) {
    return schema === 'public' ? table : `${schema}.${table}`
}

function readDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL

    const envPath = path.join(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) return undefined
    const line = fs.readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .find(candidate => candidate.trimStart().startsWith('DATABASE_URL='))
    if (!line) return undefined

    const raw = line.slice(line.indexOf('=') + 1).trim()
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        return raw.slice(1, -1)
    }
    return raw
}

function createClient(databaseUrl: string) {
    const parsed = new URL(databaseUrl)
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    const sslDisabled = parsed.searchParams.get('sslmode') === 'disable'
    return new Client({
        connectionString: databaseUrl,
        ssl: local || sslDisabled ? undefined : { rejectUnauthorized: false },
    })
}

async function main() {
    const databaseUrl = readDatabaseUrl()
    if (!databaseUrl) throw new Error('DATABASE_URL no está configurada')

    console.log('Iniciando backup consistente y de solo lectura...')

    const backupDir = path.join(process.cwd(), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_pre_migracion_${timestamp}.json`
    const filePath = path.join(backupDir, fileName)
    const client = createClient(databaseUrl)
    let transactionOpen = false

    try {
        await client.connect()
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        transactionOpen = true

        const snapshotResult = await client.query<{ snapshot_at: Date }>(
            'SELECT transaction_timestamp() AS snapshot_at',
        )
        const tablasResult = await client.query<Tabla>(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `)
        const columnasResult = await client.query<Columna>(`
            SELECT table_schema, table_name, column_name, ordinal_position,
                   data_type, udt_schema, udt_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name, ordinal_position
        `)

        const tablas = tablasResult.rows
        if (tablas.length === 0) throw new Error('La base no contiene tablas para respaldar')

        const datos: Record<string, QueryResultRow[]> = {}
        let totalRegistros = 0

        for (const tabla of tablas) {
            const schemaSeguro = quoteIdentifier(tabla.table_schema)
            const tablaSegura = quoteIdentifier(tabla.table_name)
            const filas = await client.query(`SELECT * FROM ${schemaSeguro}.${tablaSegura}`)
            const key = backupKey(tabla.table_schema, tabla.table_name)
            datos[key] = filas.rows
            totalRegistros += filas.rowCount || 0
            console.log(`Respaldada ${key}: ${filas.rowCount || 0} registro(s)`)
        }

        await client.query('COMMIT')
        transactionOpen = false

        const esquemas = [...new Set(tablas.map(tabla => tabla.table_schema))]
        const contenido = {
            _metadata: {
                formato: 3,
                creadoEn: new Date().toISOString(),
                snapshotEn: snapshotResult.rows[0].snapshot_at.toISOString(),
                consistente: true,
                soloLectura: true,
                esquemas,
                tablas: tablas.length,
                registros: totalRegistros,
            },
            estructura: columnasResult.rows,
            datos,
        }

        fs.writeFileSync(filePath, JSON.stringify(contenido, jsonReplacer, 2), { flag: 'wx' })

        const verificacion = JSON.parse(fs.readFileSync(filePath, 'utf8')) as typeof contenido
        if (
            verificacion._metadata.tablas !== tablas.length
            || verificacion._metadata.registros !== totalRegistros
            || verificacion._metadata.consistente !== true
            || Object.keys(verificacion.datos).length !== tablas.length
        ) {
            throw new Error('El archivo generado no superó la verificación de integridad')
        }

        const size = fs.statSync(filePath).size
        if (size === 0) throw new Error('El archivo de backup quedó vacío')

        console.log('\nBackup completado y verificado.')
        console.log(`Archivo: ${filePath}`)
        console.log(`Esquemas: ${esquemas.join(', ')}`)
        console.log(`Tablas: ${tablas.length}`)
        console.log(`Registros: ${totalRegistros}`)
        console.log(`Tamaño: ${size} bytes`)
    } finally {
        if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined)
        await client.end().catch(() => undefined)
    }
}

main().catch((error) => {
    console.error('Error fatal en backup:', error)
    process.exitCode = 1
})
