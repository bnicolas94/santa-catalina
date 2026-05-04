import { Suspense } from 'react'
import EmpleadoSidebar from '@/components/empleados/EmpleadoSidebar'
import Header from '@/components/layout/Header'
import styles from './empleados.module.css'

export default function EmpleadosLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className={styles.empleadosLayout}>
            <Suspense fallback={null}>
                <EmpleadoSidebar />
            </Suspense>
            <div className={styles.mainArea}>
                <Header />
                <main className={styles.content}>
                    {children}
                </main>
            </div>
        </div>
    )
}
