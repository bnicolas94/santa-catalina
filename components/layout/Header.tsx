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
