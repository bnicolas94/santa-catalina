import type { CrmSessionUser } from '@santa-catalina/contracts'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { CrmApiError } from './api'

const DEMO_AGENTS: Record<string, CrmSessionUser> = {
  marina: {
    id: 'agent-marina', name: 'Marina Soto', email: 'marina@demo.local', rol: 'ATENCION',
    permisos: { permisoAtencion: true },
  },
  lucia: {
    id: 'agent-lucia', name: 'Lucía Rojas', email: 'lucia@demo.local', rol: 'ATENCION',
    permisos: { permisoAtencion: true },
  },
  admin: {
    id: 'agent-admin', name: 'Administración', email: 'admin@demo.local', rol: 'ADMIN',
    permisos: { permisoAtencion: true, permisoAtencionAdmin: true },
  },
}

export async function requireCrmUser(request: NextRequest, admin = false): Promise<CrmSessionUser> {
  if (process.env.NODE_ENV !== 'production') {
    const demoAgent = request.headers.get('x-crm-demo-agent')?.toLowerCase() || 'marina'
    const user = DEMO_AGENTS[demoAgent] || DEMO_AGENTS.marina
    if (admin && user.rol !== 'ADMIN' && user.permisos.permisoAtencionAdmin !== true) {
      throw new CrmApiError(403, 'FORBIDDEN', 'Se requiere supervisión de Atención.')
    }
    return user
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new CrmApiError(503, 'AUTH_NOT_CONFIGURED', 'La autenticación no está configurada.')

  const token = await getToken({
    req: request,
    secret,
    cookieName: '__Secure-next-auth.session-token',
  })
  if (!token?.id) throw new CrmApiError(401, 'UNAUTHENTICATED', 'La sesión no es válida.')

  const permisos = token.permisos && typeof token.permisos === 'object'
    ? token.permisos as Record<string, unknown>
    : {}
  const isAdmin = token.rol === 'ADMIN'
  if (!isAdmin && permisos.permisoAtencion !== true && permisos.permisoAtencionAdmin !== true) {
    throw new CrmApiError(403, 'FORBIDDEN', 'No tenés acceso al CRM de Atención.')
  }
  if (admin && !isAdmin && permisos.permisoAtencionAdmin !== true) {
    throw new CrmApiError(403, 'FORBIDDEN', 'Se requiere supervisión de Atención.')
  }

  return {
    id: String(token.id),
    name: String(token.name || token.email || 'Agente'),
    email: typeof token.email === 'string' ? token.email : null,
    rol: String(token.rol || ''),
    permisos: {
      permisoAtencion: permisos.permisoAtencion === true,
      permisoAtencionAdmin: permisos.permisoAtencionAdmin === true,
    },
  }
}
