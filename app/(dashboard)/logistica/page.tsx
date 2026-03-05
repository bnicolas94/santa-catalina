import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function LogisticaPage() {
    const session = await getServerSession(authOptions)
    const rol = (session?.user as { rol?: string })?.rol

    return (
        <div>
            <div className="page-header">
                <h1>🚚 Logística</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                {(rol === 'ADMIN' || rol === 'ADMIN_OPS' || rol === 'COORD_PROD') && (
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

                {(rol === 'ADMIN' || rol === 'LOGISTICA') && (
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
            </div>
        </div>
    )
}
