import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { canAccessPath, type PermissionKey } from '@/lib/access-control'
import { COOKIE_SESION_PRODUCCION } from '@/lib/auth/cookies'

const esProduccion = process.env.NODE_ENV === 'production'

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const hostname = req.headers.get('host') || ''
        const url = req.nextUrl.clone()
        const pathname = url.pathname
        let authorizationPathname = pathname
        let shouldRewrite = false

        // 0. Lógica de Subdominio para Empleados
        // Si entran por empleados.santacatalina.online, reescribimos internamente a /empleados
        if (hostname.includes('empleados.')) {
            // Si ya empieza con /empleados (porque el link lo tiene), lo dejamos pasar
            // Si es /, lo mandamos a /empleados internamente
            if (pathname === '/') {
                url.pathname = '/empleados'
                authorizationPathname = url.pathname
                shouldRewrite = true
            }
            // Si es /123, lo mandamos a /empleados/123 internamente
            else if (!pathname.startsWith('/empleados') && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
                url.pathname = `/empleados${pathname}`
                authorizationPathname = url.pathname
                shouldRewrite = true
            }
        }

        const isApiRequest = pathname.startsWith('/api/')

        if (!token) {
            if (isApiRequest) {
                return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
            }
            return NextResponse.redirect(new URL('/login', req.url))
        }

        const accessToken = {
            rol: typeof token.rol === 'string' ? token.rol : null,
            ubicacionTipo: typeof token.ubicacionTipo === 'string' ? token.ubicacionTipo : null,
            permisos: token.permisos && typeof token.permisos === 'object'
                ? token.permisos as Partial<Record<PermissionKey, boolean>>
                : null,
        }

        if (!canAccessPath(authorizationPathname, accessToken)) {
            if (isApiRequest) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
            }
            return NextResponse.redirect(new URL('/', req.url))
        }

        return shouldRewrite ? NextResponse.rewrite(url) : NextResponse.next()
    },
    {
        // Debe coincidir con authOptions: de lo contrario el middleware no
        // encuentra la sesión compartida entre los dos subdominios.
        cookies: esProduccion
            ? { sessionToken: { name: COOKIE_SESION_PRODUCCION } }
            : undefined,
        callbacks: {
            // La respuesta 401 de las API se genera arriba en lugar de redirigir a HTML.
            authorized: () => true,
        },
    }
)

export const config = {
    matcher: [
        '/((?!api/auth|api/webhooks|api/cron|_next/static|_next/image|favicon.ico|images|fonts|login).*)',
    ],
}
