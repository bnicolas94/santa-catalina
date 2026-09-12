export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs' && (process.env.SANTA_CATALINA_SERVER === '1' || (process.env.NODE_ENV === 'production' && process.argv.includes('start'))) && process.env.MP_REPORTES_AUTO !== 'false') {
        const { iniciarReportesMP } = await import('./lib/mercadopago-worker')
        iniciarReportesMP()
    }
}
