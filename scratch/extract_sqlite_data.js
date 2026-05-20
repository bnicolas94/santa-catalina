const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const backupPath = path.join(__dirname, '../prisma/schema.prisma.backup');

try {
    console.log('1. Backing up schema.prisma...');
    fs.copyFileSync(schemaPath, backupPath);

    console.log('2. Modifying schema.prisma for SQLite...');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    schema = schema.replace(/url\s*=\s*env\("DATABASE_URL"\)/g, 'url = "file:./dev.db"');
    fs.writeFileSync(schemaPath, schema);

    console.log('3. Running prisma generate for SQLite...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('4. Fetching data using Prisma raw query...');
    const dataScript = `
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        async function main() {
            // Find all tables
            const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
            console.log('Tables:', tables);

            // Let's try query the fichas table using raw SQL
            // Schema has it mapped to "fichas_tecnicas" (plural)
            let fichas = [];
            try {
                fichas = await prisma.$queryRawUnsafe("SELECT * FROM fichas_tecnicas");
            } catch (e) {
                console.log('Error querying fichas_tecnicas, trying ficha_tecnica...', e.message);
                try {
                    fichas = await prisma.$queryRawUnsafe("SELECT * FROM ficha_tecnica");
                } catch (e2) {
                    console.log('Error querying ficha_tecnica:', e2.message);
                }
            }

            console.log('=== DATA START ===');
            console.log(JSON.stringify(fichas, null, 2));
            console.log('=== DATA END ===');
        }
        main().catch(console.error).finally(() => prisma.$disconnect());
    `;
    const tempScriptPath = path.join(__dirname, 'temp_query.js');
    fs.writeFileSync(tempScriptPath, dataScript);

    const output = execSync('npx tsx scratch/temp_query.js', { encoding: 'utf8' });
    fs.unlinkSync(tempScriptPath);

    const startIdx = output.indexOf('=== DATA START ===');
    const endIdx = output.indexOf('=== DATA END ===');
    if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = output.substring(startIdx + 18, endIdx).trim();
        fs.writeFileSync(path.join(__dirname, 'extracted_fichas.json'), jsonStr);
        console.log('✅ Successfully extracted fichas to extracted_fichas.json');
        const count = JSON.parse(jsonStr).length;
        console.log(`Found ${count} fichas in SQLite.`);
    } else {
        console.log('Could not find data markers in output:', output);
    }

} catch (error) {
    console.error('❌ Error during extraction:', error);
} finally {
    console.log('5. Restoring schema.prisma...');
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, schemaPath);
        fs.unlinkSync(backupPath);
    }
    console.log('6. Re-generating Prisma Client for PostgreSQL...');
    execSync('npx prisma generate', { stdio: 'inherit' });
}
