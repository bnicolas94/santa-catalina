'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import styles from './Sidebar.module.css'

interface MenuItem {
    label: string;
    href: string;
    icon: string;
    roles: string[];
    permissionKey?: string;
    disabled?: boolean;
}

const menuItems: MenuItem[] = [
    {
        label: 'Dashboard',
        href: '/',
        icon: '🏠',
        roles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
        permissionKey: 'permisoDashboard',
    },
    {
        label: 'Producción',
        href: '/produccion',
        icon: '🏗️',
        roles: ['ADMIN', 'COORD_PROD', 'OPERARIO'],
        permissionKey: 'permisoProduccion',
    },
    {
        label: 'Posicionamiento',
        href: '/produccion/posicionamiento',
        icon: '📍',
        roles: ['ADMIN', 'COORD_PROD'],
        permissionKey: 'permisoProduccion',
    },
    {
        label: 'Historial Pos.',
        href: '/produccion/historial',
        icon: '📜',
        roles: ['ADMIN', 'COORD_PROD'],
        permissionKey: 'permisoProduccion',
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
        permissionKey: 'permisoStock',
    },
    {
        label: 'Stock',
        href: '/stock',
        icon: '📊',
        roles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'],
        permissionKey: 'permisoStock',
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
        label: 'Importar',
        href: '/importar',
        icon: '📥',
        roles: ['ADMIN', 'ADMIN_OPS'],
    },
    {
        label: 'Logística',
        href: '/logistica',
        icon: '🚚',
        roles: ['ADMIN', 'LOGISTICA'],
    },
    {
        label: 'Flota',
        href: '/logistica/flota',
        icon: '🚐',
        roles: ['ADMIN', 'LOGISTICA'],
    },
    {
        label: 'Costos',
        href: '/costos',
        icon: '📉',
        roles: ['ADMIN'],
        permissionKey: 'permisoCostos',
    },
    {
        label: 'Caja',
        href: '/caja',
        icon: '💰',
        roles: ['ADMIN'],
        permissionKey: 'permisoCaja',
    },

    {
        label: 'Reportes',
        href: '/reportes',
        icon: '📈',
        roles: ['ADMIN'],
    },
    {
        label: 'Empleados',
        href: 'https://empleados.santacatalina.online',
        icon: '👥',
        roles: ['ADMIN'],
        permissionKey: 'permisoPersonal',
    },
]

export default function Sidebar() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const handleToggle = () => {
            console.log('Sidebar received toggleSidebar event');
            setMobileOpen(prev => !prev);
        }
        window.addEventListener('toggleSidebar', handleToggle as any)
        return () => window.removeEventListener('toggleSidebar', handleToggle as any)
    }, [])

    // Cerrar el menú en mobile al cambiar de ruta
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    const userRol = (session?.user as any)?.rol
    const permisos = (session?.user as any)?.permisos || {}

    const filteredItems = menuItems.filter(item => {
        // ADMIN siempre ve todo
        if (userRol === 'ADMIN') return true

        // Si tiene un permiso específico para esta sección, y está activo, lo dejamos pasar
        if (item.permissionKey && permisos[item.permissionKey]) {
            return true
        }

        // Fallback a los roles hardcodeados antiguos si no hay permiso dinámico seteado
        return item.roles.includes(userRol)
    })

    return (
        <>
            {mobileOpen && (
                <div 
                    className={styles.overlay} 
                    onClick={() => setMobileOpen(false)}
                />
            )}
            <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
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
                {filteredItems.map((item) => {
                    // El item es activo si es el "match" más largo (específico) que coincide con la ruta actual
                    const isLongestMatch = item.href !== '/' && 
                        (pathname === item.href || pathname?.startsWith(item.href + '/')) &&
                        !filteredItems.some(other => 
                            other.href !== item.href && 
                            other.href.length > item.href.length && 
                            (pathname === other.href || pathname?.startsWith(other.href + '/'))
                        );

                    const isActive = item.href === '/' ? pathname === '/' : isLongestMatch;

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
        </>
    )
}
