export function getCrmCallbackUrl(requestUrl: string, configuredBaseUrl?: string) {
  const request = new URL(requestUrl)
  const baseUrl = configuredBaseUrl?.trim()

  if (!baseUrl) return request.toString()

  return new URL(`${request.pathname}${request.search}`, baseUrl).toString()
}
