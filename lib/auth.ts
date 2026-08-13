import { NextAuthOptions } from 'next-auth'
import type { RolEmpleado } from '@prisma/client'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { aplicarAccesosOperativos, permisosDesdeRol } from './auth/permisosRol'
import { COOKIE_SESION_PRODUCCION, DOMINIO_COOKIE_PRODUCCION } from './auth/cookies'

const esProduccion = process.env.NODE_ENV === 'production'

type UsuarioAutenticado = {
    id?: string
    rol?: string
    ubicacionId?: string | null
    ubicacionTipo?: string | null
    permisos?: ReturnType<typeof permisosDesdeRol>
}

async function resolverRolAsignado(
    rolRelacionado: RolEmpleado | null,
    nombreRolLegado: string,
): Promise<RolEmpleado | null> {
    if (rolRelacionado) return rolRelacionado

    // Algunas cuentas anteriores al vínculo por rolId conservan únicamente el
    // nombre del tipo. Resolverlo evita que caigan en los permisos heredados
    // antiguos aunque todavía no se haya vuelto a guardar su ficha.
    return prisma.rolEmpleado.findFirst({
        where: {
            nombre: {
                equals: nombreRolLegado,
                mode: 'insensitive',
            },
        },
    })
}

export const authOptions: NextAuthOptions = {
    // La aplicación opera en app.santacatalina.online y en
    // empleados.santacatalina.online. Una cookie limitada al host dejaba una
    // sesión distinta en cada módulo y podía mostrar permisos antiguos.
    useSecureCookies: esProduccion,
    cookies: esProduccion
        ? {
            sessionToken: {
                name: COOKIE_SESION_PRODUCCION,
                options: {
                    httpOnly: true,
                    sameSite: 'lax',
                    path: '/',
                    secure: true,
                    domain: DOMINIO_COOKIE_PRODUCCION,
                },
            },
        }
        : undefined,
    providers: [
        CredentialsProvider({
            name: 'Credenciales',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Contraseña', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email y contraseña son requeridos')
                }

                const empleado = await prisma.empleado.findUnique({
                    where: { email: credentials.email },
                    include: { 
                        rolRel: true,
                        ubicacion: true
                    }
                })

                if (!empleado || !empleado.activo) {
                    throw new Error('Credenciales inválidas')
                }

                if (!empleado.password) {
                    throw new Error('Esta cuenta no tiene acceso al sistema web')
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    empleado.password
                )

                if (!isPasswordValid) {
                    throw new Error('Credenciales inválidas')
                }

                const rolAsignado = await resolverRolAsignado(empleado.rolRel, empleado.rol)

                return {
                    id: empleado.id,
                    name: empleado.nombre,
                    email: empleado.email,
                    rol: rolAsignado?.nombre || empleado.rol,
                    ubicacionId: empleado.ubicacionId,
                    ubicacionTipo: empleado.ubicacion?.tipo || null,
                    permisos: aplicarAccesosOperativos(
                        permisosDesdeRol(rolAsignado),
                        empleado.ubicacion?.tipo,
                    ),
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                const usuario = user as UsuarioAutenticado
                token.id = user.id
                token.rol = usuario.rol
                token.ubicacionId = usuario.ubicacionId
                token.ubicacionTipo = usuario.ubicacionTipo
                token.permisos = usuario.permisos
            } else if (token.id) {
                // La sesión JWT puede sobrevivir a un cambio de rol. Volvemos a
                // leer la asignación para que los accesos marcados se apliquen
                // sin obligar al usuario a borrar cookies o autenticarse de cero.
                try {
                    const empleadoActual = await prisma.empleado.findUnique({
                        where: { id: String(token.id) },
                        select: {
                            activo: true,
                            rol: true,
                            ubicacionId: true,
                            ubicacion: { select: { tipo: true } },
                            rolRel: true,
                        },
                    })
                    if (empleadoActual?.activo) {
                        const rolAsignado = await resolverRolAsignado(
                            empleadoActual.rolRel,
                            empleadoActual.rol,
                        )
                        token.rol = rolAsignado?.nombre || empleadoActual.rol
                        token.ubicacionId = empleadoActual.ubicacionId
                        token.ubicacionTipo = empleadoActual.ubicacion?.tipo || null
                        token.permisos = aplicarAccesosOperativos(
                            permisosDesdeRol(rolAsignado),
                            empleadoActual.ubicacion?.tipo,
                        )
                    }
                } catch (error) {
                    // Una caída temporal de la base no invalida una sesión que ya
                    // estaba autenticada; se conserva el último acceso conocido.
                    console.error('No se pudieron refrescar los permisos de la sesión:', error)
                }
            }

            // Caja es una herramienta operativa obligatoria para quienes trabajan
            // en el local. Se aplica también a sesiones ya iniciadas.
            token.permisos = aplicarAccesosOperativos(
                token.permisos as ReturnType<typeof permisosDesdeRol>,
                token.ubicacionTipo,
            )
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                const usuarioSesion = session.user as typeof session.user & UsuarioAutenticado
                usuarioSesion.id = String(token.id)
                usuarioSesion.rol = token.rol as string | undefined
                usuarioSesion.ubicacionId = token.ubicacionId as string | null | undefined
                usuarioSesion.ubicacionTipo = token.ubicacionTipo as string | null | undefined
                usuarioSesion.permisos = token.permisos as ReturnType<typeof permisosDesdeRol>
            }
            return session
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 8 * 60 * 60, // 8 horas (un turno de trabajo)
    },
}
