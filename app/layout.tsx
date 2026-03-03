import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from '@/components/layout/AuthProvider'

export const metadata: Metadata = {
  title: 'Santa Catalina — Sistema de Gestión',
  description: 'Sistema operativo de gestión industrial para Sandwichería Santa Catalina',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
