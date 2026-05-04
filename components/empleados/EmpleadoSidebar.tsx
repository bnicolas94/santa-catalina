'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import styles from './EmpleadoSidebar.module.css'

interface MenuItem {
    label: string;
    href: string;
    icon: string;
    openModal?: string;
    subItems?: MenuItem[];
}

const menuItems: MenuItem[] = [
    {
        label: 'Lista de Empleados',
        href: '/empleados',
        icon: '👥',
    },
    {
        label: 'Nuevo Empleado',
        href: '/empleados?open=new',
        icon: '➕',
        openModal: 'new'
    },
    {
        label: 'Importar Fichadas',
        href: '/empleados?open=import',
        icon: '📥',
        openModal: 'import'
    },
    {
        label: 'Liquidación Semanal',
        href: '/empleados?open=weekly',
        icon: '💰',
        openModal: 'weekly'
    },
    {
        label: 'Vacaciones / SAC',
        href: '/empleados?open=vacaciones',
        icon: '🏖️',
        openModal: 'vacaciones'
    },
    {
        label: 'Liquidación Masiva',
        href: '/empleados?open=mass',
        icon: '🏢',
        openModal: 'mass'
    },
    {
        label: 'Reportes',
        href: '#',
        icon: '📊',
        subItems: [
            { label: 'Recibos', href: '/empleados?open=recibos', icon: '🖨️', openModal: 'recibos' },
            { label: 'Historial Vacaciones', href: '/empleados?open=historial', icon: '📈', openModal: 'historial' },
            { label: 'Inasistencias', href: '/empleados?open=inasistencias', icon: '🚨', openModal: 'inasistencias' },
        ]
    },
    {
        label: 'Configuración',
        href: '#',
        icon: '⚙️',
        subItems: [
            { label: 'Roles', href: '/empleados?open=roles', icon: '🔑', openModal: 'roles' },
            { label: 'Feriados', href: '/empleados?open=feriados', icon: '📅', openModal: 'feriados' },
            { label: 'Turnos', href: '/empleados?open=turnos', icon: '🕒', openModal: 'turnos' },
            { label: 'Conceptos', href: '/empleados?open=conceptos', icon: '🏷️', openModal: 'conceptos' },
            { label: 'Licencias', href: '/empleados?open=licencias', icon: '⚙️', openModal: 'licencias' },
        ]
    },
]

export default function EmpleadoSidebar() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [collapsed, setCollapsed] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['Reportes', 'Configuración'])

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev => 
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        )
    }

    return (
        <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
            <div className={styles.logoContainer}>
                <Link href="/" className={styles.backLink}>
                    <span className={styles.backIcon}>←</span>
                    {!collapsed && <span>Volver al ERP</span>}
                </Link>
                <div className={styles.divider} />
                <div className={styles.appTitle}>
                    <span className={styles.icon}>👥</span>
                    {!collapsed && <strong>EMPLEADOS</strong>}
                </div>
            </div>

            <nav className={styles.nav}>
                {menuItems.map((item) => {
                    const hasSubItems = item.subItems && item.subItems.length > 0
                    const isExpanded = expandedGroups.includes(item.label)
                    const isActive = !hasSubItems && (
                        item.openModal 
                        ? searchParams.get('open') === item.openModal
                        : (pathname === item.href && !searchParams.get('open'))
                    )

                    return (
                        <div key={item.label} className={styles.menuGroup}>
                            {hasSubItems ? (
                                <>
                                    <button 
                                        className={styles.navItem} 
                                        onClick={() => toggleGroup(item.label)}
                                    >
                                        <span className={styles.navIcon}>{item.icon}</span>
                                        {!collapsed && (
                                            <>
                                                <span className={styles.navLabel}>{item.label}</span>
                                                <span className={styles.chevron}>{isExpanded ? '▾' : '▸'}</span>
                                            </>
                                        )}
                                    </button>
                                    {isExpanded && !collapsed && (
                                        <div className={styles.subItems}>
                                            {item.subItems?.map(sub => {
                                                const isSubActive = searchParams.get('open') === sub.openModal
                                                return (
                                                    <Link 
                                                        key={sub.label} 
                                                        href={sub.href}
                                                        className={`${styles.subItem} ${isSubActive ? styles.active : ''}`}
                                                    >
                                                        <span className={styles.navIcon}>{sub.icon}</span>
                                                        <span className={styles.navLabel}>{sub.label}</span>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link
                                    href={item.href}
                                    className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                >
                                    <span className={styles.navIcon}>{item.icon}</span>
                                    {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                                </Link>
                            )}
                        </div>
                    )
                })}
            </nav>

            <button
                className={styles.collapseBtn}
                onClick={() => setCollapsed(!collapsed)}
            >
                {collapsed ? '→' : '←'}
            </button>
        </aside>
    )
}
