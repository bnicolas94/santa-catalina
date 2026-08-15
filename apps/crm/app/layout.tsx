import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Atención | Santa Catalina',
  description: 'Centro de atención al cliente de Santa Catalina',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
