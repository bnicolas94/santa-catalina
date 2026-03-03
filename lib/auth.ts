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
                })

                if (!empleado || !empleado.activo) {
                    throw new Error('Credenciales inválidas')
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
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.rol = (user as any).rol
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id
                    ; (session.user as any).rol = token.rol
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
