import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Iniciando backup de base de datos...')
    
    // Directorio de backups
    const backupDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_pre_v2_reportes_${timestamp}.json`
    const filePath = path.join(backupDir, fileName)

    // Lista de modelos a respaldar (excluimos métodos internos de prisma)
    const models = Object.keys(prisma).filter(key => 
        !key.startsWith('_') && 
        !key.startsWith('$') && 
        typeof (prisma as any)[key].findMany === 'function'
    )

    const fullDump: Record<string, any> = {}

    for (const model of models) {
        console.log(`📦 Respaldando tabla: ${model}...`)
        try {
            fullDump[model] = await (prisma as any)[model].findMany()
        } catch (error) {
            console.error(`❌ Error respaldando ${model}:`, error)
        }
    }

    fs.writeFileSync(filePath, JSON.stringify(fullDump, null, 2))
    
    console.log('\n✅ Backup completado con éxito!')
    console.log(`📄 Archivo: ${filePath}`)
    console.log(`📊 Total de tablas: ${models.length}`)
}

main()
    .catch((e) => {
        console.error('❌ Error fatal en backup:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
