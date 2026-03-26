'use client'

import { useSession, signOut } from 'next-auth/react'
import styles from './Header.module.css'

export default function Header() {
    const { data: session } = useSession()

    const rolLabels: Record<string, string> = {
        ADMIN: 'Administrador',
        COORD_PROD: 'Coord. Producción',
        OPERARIO: 'Operario',
        LOGISTICA: 'Logística',
        ADMIN_OPS: 'Administrativo',
    }

    const userRol = ((session?.user as { rol?: string })?.rol) || ''

    return (
        <header className={styles.header}>
            <div className={styles.headerLeft}>
                <button 
                    className={styles.mobileMenuBtn}
                    onClick={() => {
                        console.log('Dispatching toggleSidebar event');
                        window.dispatchEvent(new CustomEvent('toggleSidebar'));
                    }}
                    aria-label="Toggle Menu"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <h2 className={styles.greeting}>
                    Hola, {session?.user?.name || 'Usuario'}
                </h2>
            </div>
            <div className={styles.headerRight}>
                <div className={styles.userInfo}>
                    <span className={styles.userName}>{session?.user?.name}</span>
                    <span className={styles.userRole}>
                        {rolLabels[userRol] || userRol}
                    </span>
                </div>
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className={styles.logoutBtn}
                    title="Cerrar sesión"
                >
                    Salir
                </button>
            </div>
        </header>
    )
}
