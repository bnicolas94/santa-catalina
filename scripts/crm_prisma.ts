import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const allowedCommands = new Set(['generate', 'validate', 'migrate-deploy'])
const requestedCommand = process.argv[2]
if (!requestedCommand || !allowedCommands.has(requestedCommand)) {
  throw new Error('Uso: tsx scripts/crm_prisma.ts <generate|validate|migrate-deploy>')
}

function readRootDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return 'postgresql://postgres:postgres@localhost:5432/santa_catalina'
  const line = fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find(candidate => candidate.trimStart().startsWith('DATABASE_URL='))
  if (!line) return 'postgresql://postgres:postgres@localhost:5432/santa_catalina'
  const raw = line.slice(line.indexOf('=') + 1).trim()
  return (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
    ? raw.slice(1, -1)
    : raw
}

const databaseUrl = new URL(readRootDatabaseUrl())
databaseUrl.searchParams.set('schema', 'crm')

const prismaCli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
const prismaArgs = requestedCommand === 'migrate-deploy'
  ? ['migrate', 'deploy']
  : [requestedCommand]
const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs, '--schema', 'apps/crm/prisma/schema.prisma'], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
