import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

const PRODUCTION_SESSION_COOKIE = '__Secure-next-auth.session-token'

export async function proxy(request: NextRequest) {
  // El prototipo local queda navegable sin depender de una sesión del ERP.
  // En producción, el subdominio comparte la cookie firmada del dominio padre.
  if (process.env.NODE_ENV !== 'production') return NextResponse.next()

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Autenticación del CRM no configurada' }, { status: 503 })
  }

  const token = await getToken({
    req: request,
    secret,
    cookieName: PRODUCTION_SESSION_COOKIE,
  })

  if (!token) {
    const erpBaseUrl = process.env.ERP_BASE_URL || 'https://app.santacatalina.online'
    const loginUrl = new URL('/login', erpBaseUrl)
    loginUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(loginUrl)
  }

  const permisos = token.permisos && typeof token.permisos === 'object'
    ? token.permisos as Record<string, unknown>
    : {}
  const tieneAcceso = token.rol === 'ADMIN'
    || permisos.permisoAtencion === true
    || permisos.permisoAtencionAdmin === true

  if (!tieneAcceso) {
    const erpBaseUrl = process.env.ERP_BASE_URL || 'https://app.santacatalina.online'
    return NextResponse.redirect(new URL('/?crm=sin-acceso', erpBaseUrl))
  }

  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'same-origin')
  return response
}

export const config = {
  matcher: ['/((?!api/health|api/webhooks|_next/static|_next/image|favicon.ico).*)'],
}
