export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs' && (process.env.SANTA_CATALINA_SERVER === '1' || (process.env.NODE_ENV === 'production' && process.argv.includes('start')))) {
        if (process.env.MP_REPORTES_AUTO !== 'false') {
            const { iniciarReportesMP } = await import('./lib/mercadopago-worker')
            iniciarReportesMP()
        }
        if (process.env.SHEETS_CAJA_AUTO !== 'false') {
            const { iniciarGoogleSheetsCaja } = await import('./lib/google-sheets-caja-worker')
            iniciarGoogleSheetsCaja()
        }
    }
}
