'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import styles from './Sidebar.module.css'

const menuItems = [
    {
        label: 'Dashboard',
        href: '/',
        icon: '🏠',
        roles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
    },
    {
        label: 'Producción',
        href: '/produccion',
        icon: '🏭',
        roles: ['ADMIN', 'COORD_PROD', 'OPERARIO'],
    },
    {
        label: 'Productos',
        href: '/productos',
        icon: '📋',
        roles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
    },
    {
        label: 'Insumos',
        href: '/insumos',
        icon: '📦',
        roles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
    },
    {
        label: 'Stock',
        href: '/stock',
        icon: '📊',
        roles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
    },
    {
        label: 'Proveedores',
        href: '/proveedores',
        icon: '🚛',
        roles: ['ADMIN', 'ADMIN_OPS'],
    },
    {
        label: 'Clientes',
        href: '/clientes',
        icon: '👥',
        roles: ['ADMIN', 'ADMIN_OPS'],
    },
    {
        label: 'Pedidos',
        href: '/pedidos',
        icon: '🧾',
        roles: ['ADMIN', 'ADMIN_OPS'],
    },
    {
        label: 'Logística',
        href: '/logistica',
        icon: '🚚',
        roles: ['ADMIN', 'LOGISTICA'],
        disabled: true, // Fase 2
    },
    {
        label: 'Costos',
        href: '/costos',
        icon: '💰',
        roles: ['ADMIN'],
        disabled: true, // Fase 3
    },
    {
        label: 'Reportes',
        href: '/reportes',
        icon: '📈',
        roles: ['ADMIN'],
        disabled: true, // Fase 2
    },
    {
        label: 'Empleados',
        href: '/empleados',
        icon: '⚙️',
        roles: ['ADMIN'],
    },
]

export default function Sidebar() {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)

    return (
        <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
            {/* Logo */}
            <div className={styles.logoContainer}>
                <Link href="/" className={styles.logoLink}>
                    <Image
                        src="/images/logo.png"
                        alt="Santa Catalina"
                        width={collapsed ? 40 : 60}
                        height={collapsed ? 40 : 60}
                        className={styles.logoImage}
                    />
                    {!collapsed && (
                        <div className={styles.logoText}>
                            <span className={styles.logoTitle}>SANTA CATALINA</span>
                            <span className={styles.logoSubtitle}>Sistema de Gestión</span>
                        </div>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                {menuItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname?.startsWith(item.href))

                    return (
                        <Link
                            key={item.href}
                            href={item.disabled ? '#' : item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''} ${item.disabled ? styles.disabled : ''
                                }`}
                            title={collapsed ? item.label : undefined}
                            onClick={(e) => item.disabled && e.preventDefault()}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            {!collapsed && (
                                <>
                                    <span className={styles.navLabel}>{item.label}</span>
                                    {item.disabled && (
                                        <span className={styles.comingSoon}>Próx.</span>
                                    )}
                                </>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Collapse toggle */}
            <button
                className={styles.collapseBtn}
                onClick={() => setCollapsed(!collapsed)}
                title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
                {collapsed ? '→' : '←'}
            </button>
        </aside>
    )
}
