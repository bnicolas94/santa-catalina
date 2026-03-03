import styles from './page.module.css'

export default function DashboardPage() {
    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
                <span className="badge badge-info">Sprint 1 — En desarrollo</span>
            </div>

            <div className={styles.statsGrid}>
                <div className={`card ${styles.statCard}`}>
                    <div className="card-body">
                        <div className={styles.statIcon}>🏭</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Producción</span>
                            <span className={styles.statValue}>—</span>
                            <span className={styles.statDetail}>Módulo en Sprint 2</span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCard}`}>
                    <div className="card-body">
                        <div className={styles.statIcon}>📦</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Stock</span>
                            <span className={styles.statValue}>—</span>
                            <span className={styles.statDetail}>Ver Insumos →</span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCard}`}>
                    <div className="card-body">
                        <div className={styles.statIcon}>📋</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Productos</span>
                            <span className={styles.statValue}>—</span>
                            <span className={styles.statDetail}>Ver Productos →</span>
                        </div>
                    </div>
                </div>

                <div className={`card ${styles.statCard}`}>
                    <div className="card-body">
                        <div className={styles.statIcon}>🚚</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statLabel}>Logística</span>
                            <span className={styles.statValue}>—</span>
                            <span className={styles.statDetail}>Módulo en Fase 2</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.welcomeCard}>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center', padding: '3rem' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Bienvenido al Sistema Santa Catalina</h2>
                        <p style={{ color: 'var(--color-gray-500)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.8' }}>
                            Este es el centro operativo de gestión. Desde el menú lateral podés acceder
                            a los módulos disponibles: <strong>Productos</strong>, <strong>Insumos</strong>,
                            <strong> Proveedores</strong> y <strong>Empleados</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
