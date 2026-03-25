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

        // Buscar la regla de rol que aplica a esta ruta
        const matchingRoute = Object.keys(routeRoles).find((route) => pathname.startsWith(route))

        if (matchingRoute && token) {
            const allowedRoles = routeRoles[matchingRoute]
            const userRole = token.rol as string

            if (!allowedRoles.includes(userRole)) {
                // Redirigir al dashboard si no tiene permisos
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
        '/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico|images|fonts|login).*)',
    ],
}
