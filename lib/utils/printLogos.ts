/**
 * Utilidad para cargar los logos como base64 data URIs para uso en ventanas de impresión.
 * 
 * PROBLEMA RAÍZ: Cuando se abre una ventana con window.open('', '_blank') y se escribe
 * HTML con document.write(), la ventana tiene origen "about:blank". Las imágenes referenciadas
 * con URLs absolutas (ej: https://app.santacatalina.online/logo.png) fallan al cargarse
 * desde este contexto porque:
 * 1. La ventana about:blank no puede resolver rutas relativas al origen de la app
 * 2. Restricciones de seguridad cross-origin en el webview de Tauri
 * 3. El navegador puede bloquear la carga de recursos desde un documento about:blank
 *
 * SOLUCIÓN: Pre-cargar las imágenes como base64 data URIs embebidos directamente en el HTML,
 * eliminando toda dependencia de red/origen.
 */

let cachedLogoBase64: string | null = null
let cachedWatermarkBase64: string | null = null

async function imageToBase64(url: string): Promise<string> {
    try {
        const res = await fetch(url)
        if (!res.ok) {
            throw new Error(`Failed to fetch image: ${res.statusText}`)
        }
        const blob = await res.blob()
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => {
                resolve(reader.result as string)
            }
            reader.onerror = () => {
                resolve(url)
            }
            reader.readAsDataURL(blob)
        })
    } catch (e) {
        console.error('Error converting image to base64:', e)
        return url
    }
}

/**
 * Obtiene las URLs base64 de los logos para impresión.
 * Cachea los resultados para no re-convertir en cada impresión.
 */
export async function getPrintLogos(): Promise<{ logo: string; watermark: string }> {
    const origin = window.location.origin

    if (!cachedLogoBase64) {
        cachedLogoBase64 = await imageToBase64(`${origin}/logo.png`)
    }
    if (!cachedWatermarkBase64) {
        cachedWatermarkBase64 = await imageToBase64(`${origin}/logo-watermark.png`)
    }

    return {
        logo: cachedLogoBase64,
        watermark: cachedWatermarkBase64
    }
}

/**
 * Invalida el caché de logos (útil si se cambian las imágenes).
 */
export function clearPrintLogosCache(): void {
    cachedLogoBase64 = null
    cachedWatermarkBase64 = null
}
