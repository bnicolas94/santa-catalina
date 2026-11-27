'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import styles from './EmpleadoSidebar.module.css'
import type { PermissionKey } from '@/lib/access-control'

interface MenuItem {
    label: string;
    href: string;
    icon: string;
    openModal?: string;
    subItems?: MenuItem[];
    permissionKey?: PermissionKey;
    adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
    {
        label: 'Lista de Empleados',
        href: '/empleados',
        icon: '👥',
        permissionKey: 'permisoPersonal',
    },
    {
        label: 'Fichado remoto',
        href: '/empleados/remotos',
        icon: '⏱️',
        permissionKey: 'permisoPersonalAsistencia',
    },
    {
        label: 'Postulaciones',
        href: process.env.NODE_ENV === 'production' ? 'https://app.santacatalina.online/postulaciones' : '/postulaciones',
        icon: '📝',
        permissionKey: 'permisoPersonalSeleccion',
    },
    {
        label: 'Nuevo Empleado',
        href: '/empleados?open=new',
        icon: '➕',
        openModal: 'new',
        permissionKey: 'permisoPersonalLegajos',
    },
    {
        label: 'Importar Fichadas',
        href: '/empleados?open=import',
        icon: '📥',
        openModal: 'import',
        permissionKey: 'permisoPersonalAsistencia',
    },
    {
        label: 'Liquidación Semanal',
        href: '/empleados/liquidacion-semanal',
        icon: '💰',
        permissionKey: 'permisoPersonalLiquidaciones',
    },
    {
        label: 'Cierres Mensuales Mixtos',
        href: '/empleados?open=cierres-mensuales',
        icon: '🗓️',
        openModal: 'cierres-mensuales', permissionKey: 'permisoPersonalLiquidaciones',
    },
    {
        label: 'Horas Extras Adeudadas',
        href: '/empleados?open=horas-adeudadas',
        icon: '⏱️',
        openModal: 'horas-adeudadas', permissionKey: 'permisoPersonalLiquidaciones',
    },
    {
        label: 'Feriados Adeudados',
        href: '/empleados?open=feriados-adeudados',
        icon: '🚩',
        openModal: 'feriados-adeudados', permissionKey: 'permisoPersonalLiquidaciones',
    },
    {
        label: 'Vacaciones / SAC',
        href: '/empleados?open=vacaciones',
        icon: '🏖️',
        openModal: 'vacaciones', permissionKey: 'permisoPersonalLiquidaciones',
    },
    {
        label: 'Liquidación Masiva',
        href: '/empleados?open=mass',
        icon: '🏢',
        openModal: 'mass', permissionKey: 'permisoPersonalLiquidaciones',
    },
    {
        label: 'Liquidación Final',
        href: '/empleados?open=liquidacion-final',
        icon: '📄',
        openModal: 'liquidacion-final', permissionKey: 'permisoPersonalLiquidaciones',
    },
    {
        label: 'Ropa de trabajo',
        href: '/empleados?open=uniformes',
        icon: '👕',
        openModal: 'uniformes', adminOnly: true,
    },
    {
        label: 'Sanciones / Apercibimientos',
        href: '/empleados?open=sanciones',
        icon: '⚖️',
        openModal: 'sanciones', permissionKey: 'permisoPersonalSanciones',
    },
    {
        label: 'Reportes',
        href: '#',
        icon: '📊',
        subItems: [
            { label: 'Recibos', href: '/empleados?open=recibos', icon: '🖨️', openModal: 'recibos', permissionKey: 'permisoPersonalLiquidaciones' },
            { label: 'Analíticas', href: '/empleados/analytics', icon: '📉', openModal: '', permissionKey: 'permisoPersonalLiquidaciones' },
            { label: 'Historial Vacaciones', href: '/empleados?open=historial', icon: '📈', openModal: 'historial', permissionKey: 'permisoPersonalLiquidaciones' },
            { label: 'Historial Salarial', href: '/empleados?open=historial-salarial', icon: '💹', openModal: 'historial-salarial', permissionKey: 'permisoPersonalLiquidaciones' },
            { label: 'Inasistencias', href: '/empleados?open=inasistencias', icon: '🚨', openModal: 'inasistencias', permissionKey: 'permisoPersonalAsistencia' },
        ]
    },
    {
        label: 'Configuración',
        href: '#',
        icon: '⚙️',
        subItems: [
            { label: 'Roles', href: '/empleados?open=roles', icon: '🔑', openModal: 'roles', adminOnly: true },
            { label: 'Feriados', href: '/empleados?open=feriados', icon: '📅', openModal: 'feriados', permissionKey: 'permisoPersonalLiquidaciones' },
            { label: 'Turnos', href: '/empleados?open=turnos', icon: '🕒', openModal: 'turnos', permissionKey: 'permisoPersonalAsistencia' },
            { label: 'Conceptos', href: '/empleados?open=conceptos', icon: '🏷️', openModal: 'conceptos', permissionKey: 'permisoPersonalLiquidaciones' },
            { label: 'Licencias', href: '/empleados?open=licencias', icon: '⚙️', openModal: 'licencias', permissionKey: 'permisoPersonalAsistencia' },
        ]
    },
]

export default function EmpleadoSidebar() {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const permisos = (session?.user as { permisos?: Partial<Record<PermissionKey, boolean>> } | undefined)?.permisos
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
                    if (item.adminOnly && !esAdmin) return null
                    if (item.permissionKey && !esAdmin && permisos?.[item.permissionKey] !== true) return null
                    const subItems = item.subItems?.filter(sub => {
                        if (sub.adminOnly && !esAdmin) return false
                        return !sub.permissionKey || esAdmin || permisos?.[sub.permissionKey] === true
                    })
                    const hasSubItems = Boolean(subItems?.length)
                    if (item.subItems && !hasSubItems) return null
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
                                            {subItems?.map(sub => {
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
