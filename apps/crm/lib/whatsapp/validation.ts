import { CrmApiError } from '../api'

type MetaPhoneNumber = {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  platform_type?: string
}
type MetaPhoneNumbersResponse = {
  data?: MetaPhoneNumber[]
  error?: { code?: number; message?: string; type?: string }
}

export type ValidatedWhatsAppChannel = {
  phoneNumberId: string
  displayPhoneNumber: string | null
  verifiedName: string | null
  qualityRating: string | null
  platformType: string | null
}

export async function validateMetaChannel(input: {
  graphApiVersion: string
  wabaId: string
  phoneNumberId: string
  accessToken: string
}, fetcher: typeof fetch = fetch): Promise<ValidatedWhatsAppChannel> {
  if (!/^v\d+\.\d+$/.test(input.graphApiVersion)) {
    throw new CrmApiError(400, 'INVALID_GRAPH_VERSION', 'La versión de Graph API debe tener formato v23.0.')
  }

  const url = new URL(
    `${input.graphApiVersion}/${encodeURIComponent(input.wabaId)}/phone_numbers`,
    'https://graph.facebook.com/',
  )
  url.searchParams.set('fields', 'id,display_phone_number,verified_name,quality_rating,platform_type')

  let response: Response
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
  } catch (error) {
    if (error instanceof CrmApiError) throw error
    throw new CrmApiError(502, 'META_UNAVAILABLE', 'Meta no respondió a tiempo. Intentá validar nuevamente.')
  }

  const result = await response.json().catch(() => ({})) as MetaPhoneNumbersResponse
  if (!response.ok) {
    const detail = String(result.error?.message || '').replace(/\s+/g, ' ').slice(0, 240)
    throw new CrmApiError(
      502,
      'META_VALIDATION_FAILED',
      detail ? `Meta rechazó la validación: ${detail}` : `Meta rechazó la validación (HTTP ${response.status}).`,
    )
  }

  const phone = result.data?.find(item => item.id === input.phoneNumberId)
  if (!phone) {
    throw new CrmApiError(409, 'PHONE_NOT_IN_WABA', 'El Phone Number ID no pertenece al WABA configurado o el token no puede verlo.')
  }

  return {
    phoneNumberId: phone.id,
    displayPhoneNumber: phone.display_phone_number || null,
    verifiedName: phone.verified_name || null,
    qualityRating: phone.quality_rating || null,
    platformType: phone.platform_type || null,
  }
}
