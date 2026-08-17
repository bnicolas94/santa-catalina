import type { ErpCustomerCandidate, ErpCustomerDetails } from '@santa-catalina/contracts'
import { CrmApiError } from '@/lib/api'

type ResolutionResponse = { candidates: ErpCustomerCandidate[] }

function erpBaseUrl() {
  const configured = process.env.ERP_BASE_URL?.trim()
  if (!configured) throw new CrmApiError(503, 'ERP_NOT_CONFIGURED', 'La conexión con el ERP no está configurada.')
  return configured.endsWith('/') ? configured : `${configured}/`
}

async function getFromErp<T>(path: string, cookie: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6_000)
  try {
    const response = await fetch(new URL(path, erpBaseUrl()), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Cookie: cookie,
      },
    })
    if (response.status >= 300 && response.status < 400) {
      throw new CrmApiError(502, 'ERP_AUTH_FAILED', 'El ERP no aceptó la sesión del agente.')
    }
    if (!response.ok) {
      throw new CrmApiError(502, 'ERP_UNAVAILABLE', 'El ERP no pudo responder la consulta.')
    }
    return await response.json() as T
  } catch (error) {
    if (error instanceof CrmApiError) throw error
    throw new CrmApiError(502, 'ERP_UNAVAILABLE', 'El ERP no está disponible temporalmente.')
  } finally {
    clearTimeout(timeout)
  }
}

export function resolveErpCustomer(phoneE164: string, cookie: string) {
  const query = new URLSearchParams({ phoneE164 })
  return getFromErp<ResolutionResponse>(`api/internal/crm/customers/resolve?${query}`, cookie)
}

export function getErpCustomerSummary(erpClientId: string, cookie: string) {
  return getFromErp<ErpCustomerDetails>(
    `api/internal/crm/customers/${encodeURIComponent(erpClientId)}/summary`,
    cookie,
  )
}
