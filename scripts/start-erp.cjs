// Habilita el proceso de reportes sólo al iniciar el servidor, nunca durante el build.
const { spawn, spawnSync } = require('node:child_process')

const migracion = spawnSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    { stdio: 'inherit', env: process.env },
)
if (migracion.error) {
    console.error('No se pudieron iniciar las migraciones de la base.', migracion.error)
    process.exit(1)
}
if (migracion.status !== 0) process.exit(migracion.status ?? 1)

const servidor = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, SANTA_CATALINA_SERVER: '1' },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => servidor.kill(signal))
servidor.on('error', () => process.exit(1))
servidor.on('exit', code => process.exit(code ?? 1))
