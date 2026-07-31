import { formatCurrencyToWords } from '@/lib/utils/numberToWords'
import { getPrintLogos } from '@/lib/utils/printLogos'

export interface EmpleadoReciboPrestamo {
    nombre: string
    apellido?: string | null
    dni?: string | null
}

export interface PrestamoRecibo {
    id: string
    fechaSolicitud: string
    montoTotal: number
    cantidadCuotas: number
    frecuencia: string
    observaciones?: string | null
    origenEntrega?: string | null
    cuotas: Array<{
        numeroCuota: number
        monto: number
        fechaVencimiento: string
    }>
}

const formatoMoneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Buenos_Aires',
})

const NOMBRES_CAJA: Record<string, string> = {
    caja_chica: 'Caja Chica (Fábrica)',
    caja_chica_local: 'Caja Chica Local',
    mercado_pago: 'Mercado Pago',
    mercado_pago_juani: 'Mercado Pago Juani',
    mercaderia: 'Retiro de mercadería',
}

const escaparHtml = (valor: string) => valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

function descripcionCuota(prestamo: PrestamoRecibo): string {
    const importes = [...new Set(prestamo.cuotas.map(cuota => formatoMoneda.format(cuota.monto)))]
    if (importes.length === 0) return 'Sin detalle'
    if (importes.length === 1) return importes[0]
    return `${importes[0]} / ${importes.at(-1)}`
}

export async function imprimirReciboPrestamo(prestamo: PrestamoRecibo, empleado: EmpleadoReciboPrestamo): Promise<void> {
    const { logo, watermark } = await getPrintLogos()
    const nombreEmpleado = escaparHtml(`${empleado.nombre} ${empleado.apellido || ''}`.trim())
    const dni = escaparHtml(empleado.dni || 'Sin informar')
    const fechaOtorgamiento = formatoFecha.format(new Date(prestamo.fechaSolicitud))
    const frecuencia = prestamo.frecuencia === 'MENSUAL' ? 'Mensual' : 'Semanal'
    const primeraCuota = prestamo.cuotas[0]
    const ultimaCuota = prestamo.cuotas.at(-1)
    const observaciones = prestamo.observaciones
        ? escaparHtml(prestamo.observaciones)
        : 'Sin observaciones'
    const origen = escaparHtml(NOMBRES_CAJA[prestamo.origenEntrega || ''] || prestamo.origenEntrega || 'Sin informar')
    const montoLetras = escaparHtml(formatCurrencyToWords(prestamo.montoTotal))
    const numeroComprobante = escaparHtml(prestamo.id.slice(0, 8).toUpperCase())

    const marco = document.createElement('iframe')
    marco.setAttribute('aria-hidden', 'true')
    marco.style.position = 'fixed'
    marco.style.right = '0'
    marco.style.bottom = '0'
    marco.style.width = '1px'
    marco.style.height = '1px'
    marco.style.border = '0'
    marco.style.opacity = '0'
    document.body.appendChild(marco)

    const documento = marco.contentDocument
    if (!documento) {
        marco.remove()
        throw new Error('No se pudo preparar el recibo para imprimir.')
    }

    documento.write(`
        <!doctype html>
        <html lang="es">
        <head>
            <title>Recibo de préstamo - ${nombreEmpleado}</title>
            <style>
                @page { size: A4; margin: 18mm; }
                * { box-sizing: border-box; }
                body { margin: 0; color: #111827; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
                .receipt { position: relative; min-height: 245mm; padding: 34px; border: 1px solid #d1d5db; overflow: hidden; }
                .watermark { position: absolute; width: 70%; max-width: 480px; top: 52%; left: 50%; transform: translate(-50%, -50%); opacity: .07; z-index: 0; }
                .content { position: relative; z-index: 1; }
                .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 2px solid #dc1f35; }
                .logo { height: 58px; width: auto; }
                .header-copy { text-align: right; }
                .eyebrow { color: #dc1f35; font-size: 9pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
                h1 { margin: 4px 0; font-size: 19pt; text-transform: uppercase; }
                .meta { color: #4b5563; font-size: 9pt; }
                .employee { display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px; margin: 24px 0; padding: 18px; background: #f9fafb; border-radius: 8px; }
                .label { display: block; color: #6b7280; font-size: 8.5pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
                .value { display: block; margin-top: 3px; font-weight: 700; }
                .statement { margin: 24px 0; font-size: 12pt; }
                .amount { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 18px 20px; color: white; background: #dc1f35; border-radius: 8px; }
                .amount strong { font-size: 21pt; }
                .words { margin-top: 10px; color: #4b5563; font-size: 9.5pt; }
                .details { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 24px 0; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; background: #d1d5db; }
                .detail { min-height: 66px; padding: 12px 14px; background: white; }
                .note { padding: 14px 16px; border-left: 4px solid #dc1f35; background: #fff7f8; font-size: 9.5pt; }
                .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; margin-top: 88px; }
                .signature { padding-top: 8px; border-top: 1px solid #111827; text-align: center; font-size: 9.5pt; }
                .footer { position: absolute; right: 34px; bottom: 24px; left: 34px; color: #6b7280; font-size: 8pt; text-align: center; }
                @media print { * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <main class="receipt">
                <img class="watermark" src="${watermark}" alt="" />
                <div class="content">
                    <header class="header">
                        <img class="logo" src="${logo}" alt="Santa Catalina" />
                        <div class="header-copy">
                            <div class="eyebrow">Comprobante de entrega</div>
                            <h1>Préstamo al empleado</h1>
                            <div class="meta">N.º ${numeroComprobante} · ${fechaOtorgamiento}</div>
                        </div>
                    </header>
                    <section class="employee">
                        <div><span class="label">Empleado</span><span class="value">${nombreEmpleado}</span></div>
                        <div><span class="label">DNI</span><span class="value">${dni}</span></div>
                    </section>
                    <p class="statement">Se deja constancia de que el empleado recibe el préstamo o adelanto detallado a continuación.</p>
                    <div class="amount"><span>Importe otorgado</span><strong>${formatoMoneda.format(prestamo.montoTotal)}</strong></div>
                    <div class="words">Son pesos: ${montoLetras}.</div>
                    <section class="details">
                        <div class="detail"><span class="label">Cantidad de cuotas</span><span class="value">${prestamo.cantidadCuotas}</span></div>
                        <div class="detail"><span class="label">Frecuencia</span><span class="value">${frecuencia}</span></div>
                        <div class="detail"><span class="label">Importe por cuota</span><span class="value">${descripcionCuota(prestamo)}</span></div>
                        <div class="detail"><span class="label">Forma de entrega</span><span class="value">${origen}</span></div>
                        <div class="detail"><span class="label">Primera cuota</span><span class="value">${primeraCuota ? formatoFecha.format(new Date(primeraCuota.fechaVencimiento)) : 'Sin informar'}</span></div>
                        <div class="detail"><span class="label">Última cuota prevista</span><span class="value">${ultimaCuota ? formatoFecha.format(new Date(ultimaCuota.fechaVencimiento)) : 'Sin informar'}</span></div>
                    </section>
                    <div class="note"><strong>Observaciones:</strong> ${observaciones}<br />Las cuotas se registran en la cuenta del empleado con la frecuencia indicada.</div>
                    <section class="signatures">
                        <div class="signature">Firma y aclaración del empleado</div>
                        <div class="signature">Firma y aclaración del responsable</div>
                    </section>
                </div>
                <div class="footer">Comprobante interno emitido por el sistema de gestión de Santa Catalina.</div>
            </main>
            <script>
                window.onload = () => {
                    const images = Array.from(document.images);
                    Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; }))).then(() => {
                        window.focus();
                        window.print();
                    });
                };
                window.addEventListener('afterprint', () => window.frameElement?.remove(), { once: true });
            </script>
        </body>
        </html>
    `)
    documento.close()
    window.setTimeout(() => marco.remove(), 120000)
}
