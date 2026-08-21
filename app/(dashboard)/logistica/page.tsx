import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function LogisticaPage() {
    const session = await getServerSession(authOptions)
    const user = session?.user as { rol?: string; permisos?: Record<string, boolean> } | undefined
    const esAdmin = user?.rol === 'ADMIN'
    const esLogisticaLegado = user?.permisos == null && user?.rol === 'LOGISTICA'
    const puedeLogistica = esAdmin || esLogisticaLegado || user?.permisos?.permisoLogistica === true
    const puedeFlota = esAdmin || esLogisticaLegado || user?.permisos?.permisoFlota === true
    const puedeAdministrarChoferes = puedeLogistica && (esAdmin || user?.permisos?.permisoPersonal === true)

    return (
        <div>
            <div className="page-header">
                <h1>🚚 Logística</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                {puedeLogistica && (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Rutas y Planificación</h2>
                        <p style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', flex: 1 }}>
                            Armá las rutas diarias, asigná pedidos confirmados a repartidores y controlá las temperaturas de salida.
                        </p>
                        <Link href="/logistica/rutas" className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>
                            Gestionar Rutas
                        </Link>
                    </div>
                )}

                {puedeLogistica && (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Mis Repartos</h2>
                        <p style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', flex: 1 }}>
                            Accedé a tus rutas asignadas del día, marcá entregas, registrá incidencias y controlá la cadena de frío.
                        </p>
                        <Link href="/logistica/repartos" className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>
                            Ver mis entregas
                        </Link>
                    </div>
                )}

                {puedeFlota && (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Gestión de Flota</h2>
                        <p style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', flex: 1 }}>
                            Controlá los vehículos, mantenimientos y asigná qué auto usa cada chofer cada día.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <Link href="/logistica/flota/asignacion" className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
                                    Asignación Diaria
                                </Link>
                                <Link href="/logistica/flota" className="btn btn-outline" style={{ flex: 1, textAlign: 'center' }}>
                                    Dashboard Flota
                                </Link>
                            </div>
                            {puedeAdministrarChoferes && (
                                <Link href="/logistica/choferes" className="btn btn-ghost" style={{ width: '100%', textAlign: 'center', border: '1px solid var(--color-gray-200)' }}>
                                    👤 Administración de Choferes
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
