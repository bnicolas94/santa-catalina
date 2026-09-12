// Habilita el proceso de reportes sólo al iniciar el servidor, nunca durante el build.
const { spawn } = require('node:child_process')
const servidor = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, SANTA_CATALINA_SERVER: '1' },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => servidor.kill(signal))
servidor.on('error', () => process.exit(1))
servidor.on('exit', code => process.exit(code ?? 1))
