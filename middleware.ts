import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Mapa de rutas → roles permitidos
const routeRoles: Record<string, string[]> = {
    '/produccion': ['ADMIN', 'COORD_PROD', 'OPERARIO'],
    '/productos': ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
    '/insumos': ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
    '/stock': ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
    '/proveedores': ['ADMIN', 'ADMIN_OPS'],
    '/clientes': ['ADMIN', 'ADMIN_OPS'],
    '/pedidos': ['ADMIN', 'ADMIN_OPS'],
    '/empleados': ['ADMIN'],
}

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const pathname = req.nextUrl.pathname

        if (!token) return NextResponse.redirect(new URL('/login', req.url))

        const userRol = token.rol as string
        const permisos = (token.permisos as any) || {}

        // 1. Verificación por permisos dinámicos (Prioridad)
        if (pathname.startsWith('/produccion') && permisos.permisoProduccion) return NextResponse.next()
        if (pathname.startsWith('/stock') && permisos.permisoStock) return NextResponse.next()
        if (pathname.startsWith('/insumos') && permisos.permisoStock) return NextResponse.next()
        if (pathname.startsWith('/caja') && permisos.permisoCaja) return NextResponse.next()
        if (pathname.startsWith('/empleados') && permisos.permisoPersonal) return NextResponse.next()
        if (pathname.startsWith('/costos') && permisos.permisoCostos) return NextResponse.next()
        if (pathname.startsWith('/') && pathname.length === 1 && permisos.permisoDashboard) return NextResponse.next()

        // 2. Fallback a mapa estático para rutas legacy o roles base
        const matchingRoute = Object.keys(routeRoles).find((route) => pathname.startsWith(route))

        if (matchingRoute) {
            const allowedRoles = routeRoles[matchingRoute]
            if (!allowedRoles.includes(userRol)) {
                return NextResponse.redirect(new URL('/', req.url))
            }
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
)

export const config = {
    matcher: [
        '/((?!api/auth|api/webhooks|api/cron|_next/static|_next/image|favicon.ico|images|fonts|login).*)',
    ],
}
