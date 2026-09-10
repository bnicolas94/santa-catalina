import type { ErpCustomerCandidate, ErpCustomerDetails, ErpEmployeeReference, ErpOrderDetails, ErpPickupLocation, ErpProductCatalogItem } from '@santa-catalina/contracts'
import { CrmApiError } from '@/lib/api'

type ResolutionResponse = { candidates: ErpCustomerCandidate[] }

export const DEMO_PICKUP_LOCATIONS: ErpPickupLocation[] = [
  { id: 'demo-local-centro', name: 'Local Centro' },
  { id: 'demo-local-fabrica', name: 'Local Fábrica' },
]

export const DEMO_PRODUCT_CATALOG: ErpProductCatalogItem[] = [
  { id: 'demo-product-classic', name: 'Triple clásico', code: 'CLA', presentations: [{ id: 'demo-classic-48', unitsPerPackage: 48, basePrice: 42000 }, { id: 'demo-classic-24', unitsPerPackage: 24, basePrice: 22000 }] },
  { id: 'demo-product-ham-cheese', name: 'Jamón y queso', code: 'JYQ', presentations: [{ id: 'demo-ham-cheese-48', unitsPerPackage: 48, basePrice: 44500 }, { id: 'demo-ham-cheese-24', unitsPerPackage: 24, basePrice: 23500 }] },
  { id: 'demo-product-selected', name: 'Surtido elegido', code: 'ELE', presentations: [{ id: 'demo-selected-48', unitsPerPackage: 48, basePrice: 48000 }] },
]

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

export function getErpPickupLocations(cookie: string) {
  return getFromErp<ErpPickupLocation[]>('api/internal/crm/pickup-locations', cookie)
}

export function getAvailablePickupLocations(cookie: string) {
  return process.env.NODE_ENV === 'production'
    ? getErpPickupLocations(cookie)
    : Promise.resolve(DEMO_PICKUP_LOCATIONS)
}

export function getErpEmployeeReferences(ids: string[], cookie: string) {
  const query = new URLSearchParams({ ids: [...new Set(ids)].slice(0, 50).join(',') })
  return getFromErp<ErpEmployeeReference[]>(`api/internal/crm/employees?${query}`, cookie)
}

export function getErpProductCatalog(cookie: string) {
  return getFromErp<ErpProductCatalogItem[]>('api/internal/crm/catalog', cookie)
}

export function getAvailableProductCatalog(cookie: string) {
  return process.env.NODE_ENV === 'production'
    ? getErpProductCatalog(cookie)
    : Promise.resolve(DEMO_PRODUCT_CATALOG)
}

export function getErpOrderDetails(orderId: string, cookie: string) {
  return getFromErp<ErpOrderDetails>(`api/internal/crm/orders/${encodeURIComponent(orderId)}`, cookie)
}
