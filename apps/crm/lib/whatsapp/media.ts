import { CrmApiError } from '../api'
import { decryptSecret } from '../secrets'
import { isWhatsAppMockEnabled } from './provider'

type MediaChannel = {
  provider: string
  graphApiVersion: string
  accessTokenCiphertext: string | null
  accessTokenIv: string | null
  accessTokenTag: string | null
}

const MAX_IMAGE_BYTES = 16 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function validatedYCloudMediaUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new CrmApiError(502, 'INVALID_MEDIA_URL', 'El enlace de la imagen no es válido.') }
  if (url.protocol !== 'https:' || url.hostname !== 'api.ycloud.com' || url.port || url.username || url.password
    || !/^\/v2\/whatsapp\/media\/download\/[^/]+$/.test(url.pathname)) {
    throw new CrmApiError(502, 'INVALID_MEDIA_URL', 'El enlace de la imagen no pertenece a YCloud.')
  }
  return url.toString()
}

export async function downloadWhatsAppImage(
  channel: MediaChannel,
  media: { mediaId: string | null; mediaUrl: string | null },
  fetcher: typeof fetch = fetch,
) {
  if (isWhatsAppMockEnabled()) throw new CrmApiError(409, 'MOCK_MEDIA', 'La descarga real está deshabilitada en modo de prueba.')
  if (!channel.accessTokenCiphertext || !channel.accessTokenIv || !channel.accessTokenTag) {
    throw new CrmApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'El canal no tiene credenciales para descargar imágenes.')
  }
  const token = decryptSecret({ ciphertext: channel.accessTokenCiphertext, iv: channel.accessTokenIv, tag: channel.accessTokenTag })
  const headers: Record<string, string> = {}
  let url: string
  if (channel.provider === 'YCLOUD') {
    if (!media.mediaUrl && !media.mediaId) throw new CrmApiError(404, 'MEDIA_MISSING', 'La imagen no tiene un archivo disponible.')
    url = validatedYCloudMediaUrl(media.mediaUrl || `https://api.ycloud.com/v2/whatsapp/media/download/${encodeURIComponent(media.mediaId!)}`)
    headers['X-API-Key'] = token
  } else {
    if (!media.mediaId) throw new CrmApiError(404, 'MEDIA_MISSING', 'La imagen no tiene un identificador disponible.')
    const metadataResponse = await fetcher(`https://graph.facebook.com/${encodeURIComponent(channel.graphApiVersion)}/${encodeURIComponent(media.mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15_000), cache: 'no-store',
    })
    if (!metadataResponse.ok) throw new CrmApiError(502, 'MEDIA_UNAVAILABLE', 'Meta no pudo recuperar la imagen.')
    const metadata = await metadataResponse.json() as { url?: string }
    const remote = new URL(metadata.url || 'https://invalid.local')
    const trustedHost = ['fbsbx.com', 'fbcdn.net', 'facebook.com'].some(domain => remote.hostname === domain || remote.hostname.endsWith(`.${domain}`))
    if (remote.protocol !== 'https:' || !trustedHost || remote.port || remote.username || remote.password) {
      throw new CrmApiError(502, 'INVALID_MEDIA_URL', 'Meta devolvió un enlace de archivo no válido.')
    }
    url = remote.toString()
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetcher(url, { headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new CrmApiError(502, 'MEDIA_DOWNLOAD_FAILED', 'No se pudo descargar la imagen. Intentá nuevamente.')
  }
  if (!response.ok) throw new CrmApiError(502, 'MEDIA_UNAVAILABLE', 'El proveedor no tiene disponible esta imagen; puede haber vencido el archivo.')
  const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!IMAGE_TYPES.has(mimeType)) throw new CrmApiError(502, 'INVALID_IMAGE_TYPE', 'El proveedor no devolvió un formato de imagen compatible.')
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
    await response.body?.cancel()
    throw new CrmApiError(413, 'IMAGE_TOO_LARGE', 'La imagen supera el tamaño permitido.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new CrmApiError(502, 'EMPTY_IMAGE', 'El proveedor devolvió una imagen vacía.')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.byteLength
    if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new CrmApiError(413, 'IMAGE_TOO_LARGE', 'La imagen supera el tamaño permitido.') }
    chunks.push(part.value)
  }
  if (size === 0) throw new CrmApiError(502, 'EMPTY_IMAGE', 'El proveedor devolvió una imagen vacía.')
  return { bytes: Buffer.concat(chunks), mimeType }
}
