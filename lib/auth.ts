import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
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

                return {
                    id: empleado.id,
                    name: empleado.nombre,
                    email: empleado.email,
                    rol: empleado.rol,
                    ubicacionId: empleado.ubicacionId,
                    ubicacionTipo: empleado.ubicacion?.tipo || null,
                    permisos: empleado.rolRel ? {
                        permisoDashboard: empleado.rolRel.permisoDashboard,
                        permisoStock: empleado.rolRel.permisoStock,
                        permisoCaja: empleado.rolRel.permisoCaja,
                        permisoPersonal: empleado.rolRel.permisoPersonal,
                        permisoProduccion: empleado.rolRel.permisoProduccion,
                        permisoCostos: empleado.rolRel.permisoCostos,
                    } : null
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.rol = (user as any).rol
                token.ubicacionId = (user as any).ubicacionId
                token.ubicacionTipo = (user as any).ubicacionTipo
                token.permisos = (user as any).permisos
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
                (session.user as any).rol = token.rol;
                (session.user as any).ubicacionId = token.ubicacionId;
                (session.user as any).ubicacionTipo = token.ubicacionTipo;
                (session.user as any).permisos = token.permisos;
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
