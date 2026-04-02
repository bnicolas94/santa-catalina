'use client'

import { useState, useEffect } from 'react'
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import ProduccionReport from './ProduccionReport'
import KpiCard from './components/KpiCard'
import PeriodoSelector from './components/PeriodoSelector'
import DrillDownModal from './components/DrillDownModal'
import ReportSettingsModal from './components/ReportSettingsModal'
import { exportReportToExcel } from './utils/exportUtils'
import { useSession } from 'next-auth/react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

// --- Interfaces ---
interface RentabilidadData {
    mes: number
    anio: number
    ingresosTotales: number
    costoMercaderiaVendida: number
    margenBruto: number
    totalGastos: number
    rentabilidadNeta: number
    margenEbitda: number
    gastosPorCategoria: Record<string, number>
}

interface ProduccionData {
    mes: number
    anio: number
    globales: {
        totalPaquetes: number
        totalPlanchas: number
        totalSanguchitos: number
        totalRechazados: number
        totalLotes: number
    }
    desglose: {
        nombre: string
        codigo: string
        paquetes: number
        planchas: number
        sanguchitos: number
        rechazados: number
    }[]
    tendencia: {
        semana: string
        paquetes: number
    }[]
}

interface Metadata {
    ubicaciones: { id: string, nombre: string, tipo: string }[]
    years: string[]
    categoriasGasto: { id: string, nombre: string, esOperativo: boolean }[]
}

export default function ReportesPage() {
    const { data: session } = useSession()
    const isAdmin = (session?.user as any)?.rol === 'ADMIN'

    const [activeTab, setActiveTab] = useState<'economico' | 'produccion'>('economico')
    const [rentabilidadData, setRentabilidadData] = useState<RentabilidadData | null>(null)
    const [produccionData, setProduccionData] = useState<ProduccionData | null>(null)
    const [metadata, setMetadata] = useState<Metadata>({ ubicaciones: [], years: [], categoriasGasto: [] })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [userPrefs, setUserPrefs] = useState({
        showIngresos: true,
        showGastos: true,
        showMargen: true,
        showProduccion: true,
        showProdPaquetes: true,
        showProdPlanchas: true,
        showProdSanguchitos: true,
        showProdRechazados: true
    })

    const [globalConfig, setGlobalConfig] = useState({
        sanguchitosPorPlancha: 8,
        planchasPorPaqueteDefault: 6
    })

    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    const [mes, setMes] = useState(String(new Date().getMonth() + 1))
    const [anio, setAnio] = useState(String(new Date().getFullYear()))
    const [ubicacionId, setUbicacionId] = useState('')

    const [drillDown, setDrillDown] = useState<{
        tipo: 'pedidos' | 'gastos' | 'lotes',
        label: string,
        categoriaId?: string
    } | null>(null)

    useEffect(() => {
        fetchMetadata()
        fetchPrefs()
        fetchConfig()
    }, [])

    useEffect(() => {
        fetchData()
    }, [mes, anio, ubicacionId, activeTab])

    async function fetchMetadata() {
        try {
            const res = await fetch('/api/reportes/metadata')
            const json = await res.json()
            setMetadata(json)
            if (json.years.length > 0 && !json.years.includes(anio)) {
                setAnio(json.years[json.years.length - 1])
            }
        } catch (err) {
            console.error('Error fetching metadata:', err)
        }
    }

    async function fetchPrefs() {
        try {
            const res = await fetch('/api/reportes/preferencias')
            if (res.ok) {
                const json = await res.json()
                setUserPrefs(json)
            }
        } catch (err) {
            console.error('Error fetching prefs:', err)
        }
    }

    async function fetchConfig() {
        try {
            const [s, p] = await Promise.all([
                fetch('/api/reportes/config?clave=SANGUCHITOS_POR_PLANCHA').then(r => r.json()),
                fetch('/api/reportes/config?clave=PLANCHAS_POR_PAQUETE_DEFAULT').then(r => r.json())
            ])
            setGlobalConfig({
                sanguchitosPorPlancha: s.valor || 8,
                planchasPorPaqueteDefault: p.valor || 6
            })
        } catch (err) {
            console.error('Error fetching config:', err)
        }
    }

    async function handleUpdatePrefs(newPrefs: any) {
        setUserPrefs(newPrefs)
        await fetch('/api/reportes/preferencias', {
            method: 'POST',
            body: JSON.stringify({ preferencias: newPrefs })
        })
    }

    async function handleUpdateCategory(id: string, esOperativo: boolean) {
        setMetadata(prev => ({
            ...prev,
            categoriasGasto: prev.categoriasGasto.map(c => c.id === id ? { ...c, esOperativo } : c)
        }))
        await fetch('/api/reportes/categorias', {
            method: 'POST',
            body: JSON.stringify({ id, esOperativo })
        })
        fetchData() // Refrescar datos ya que cambia el cálculo
    }

    async function handleUpdateGlobalConfig(clave: string, valor: any) {
        setGlobalConfig(prev => ({
            ...prev,
            [clave === 'SANGUCHITOS_POR_PLANCHA' ? 'sanguchitosPorPlancha' : 'planchasPorPaqueteDefault']: valor
        }))
        await fetch('/api/reportes/config', {
            method: 'POST',
            body: JSON.stringify({ clave, valor })
        })
        fetchData()
    }

    async function fetchData(refresh = false) {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                mes,
                anio,
                ...(ubicacionId && { ubicacionId }),
                ...(refresh && { refresh: 'true' })
            })
            
            const url = activeTab === 'economico' 
                ? `/api/reportes/rentabilidad?${params}`
                : `/api/reportes/produccion?${params}`
            
            const res = await fetch(url)
            if (res.status === 403) {
                setError('No tienes permisos para ver este reporte.')
                return
            }
            if (!res.ok) throw new Error('Error al obtener datos')

            const json = await res.json()
            if (activeTab === 'economico') setRentabilidadData(json)
            else setProduccionData(json)
        } catch (err) {
            console.error('Error fetching reporte:', err)
            setError('Ocurrió un error al cargar el reporte.')
        } finally {
            setLoading(false)
        }
    }

    const handleExport = () => {
        const reportData = activeTab === 'economico' ? rentabilidadData : produccionData
        if (!reportData) return
        exportReportToExcel(reportData, activeTab, mes, anio)
    }

    // --- Economico Charts ---
    const barData = rentabilidadData ? {
        labels: [`${mes}/${anio}`],
        datasets: [
            { label: 'Facturación', data: [rentabilidadData.ingresosTotales], backgroundColor: '#3498DB' },
            { label: 'CMV', data: [rentabilidadData.costoMercaderiaVendida], backgroundColor: '#F39C12' },
            { label: 'Gastos', data: [rentabilidadData.totalGastos], backgroundColor: '#E74C3C' },
            { 
                label: 'EBITDA', 
                data: [rentabilidadData.rentabilidadNeta], 
                backgroundColor: rentabilidadData.rentabilidadNeta >= 0 ? '#2ECC71' : '#E74C3C' 
            }
        ],
    } : null

    const catKeys = rentabilidadData ? Object.keys(rentabilidadData.gastosPorCategoria) : []
    const pieData = rentabilidadData ? {
        labels: catKeys.length > 0 ? catKeys : ['Sin Gastos'],
        datasets: [{
            data: catKeys.length > 0 ? Object.values(rentabilidadData.gastosPorCategoria) : [1],
            backgroundColor: catKeys.length > 0
                ? catKeys.map((_, i) => ['#E74C3C', '#9B59B6', '#34495E', '#F1C40F', '#1ABC9C', '#E67E22'][i % 6])
                : ['#ddd'],
            borderWidth: 0,
        }]
    } : null

    return (
        <div className="fade-in">
            <PeriodoSelector 
                mes={mes} anio={anio} ubicacionId={ubicacionId}
                activeTab={activeTab} loading={loading}
                ubicaciones={metadata.ubicaciones} anios={metadata.years}
                onMesChange={setMes} onAnioChange={setAnio}
                onUbicacionChange={setUbicacionId} onTabChange={setActiveTab}
                onRefresh={() => fetchData(true)} onExport={handleExport}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
                <button 
                    className="btn btn-outline" 
                    onClick={() => setIsSettingsOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                    <span>⚙️</span> Configurar Variables
                </button>
            </div>

            {error ? (
                <div className="empty-state"><p style={{ color: 'var(--color-danger)' }}>{error}</p></div>
            ) : loading && !rentabilidadData && !produccionData ? (
                <div className="empty-state"><div className="spinner" /><p>Generando reporte...</p></div>
            ) : (
                <>
                    {activeTab === 'economico' && rentabilidadData && (
                        <div className="fade-in">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                                {userPrefs.showIngresos && (
                                    <div onClick={() => setDrillDown({ tipo: 'pedidos', label: 'Ingresos Brutos' })} style={{ cursor: 'pointer' }}>
                                        <KpiCard label="Ingresos Brutos" value={`$${rentabilidadData.ingresosTotales.toLocaleString('es-AR')}`} color="var(--color-primary)" />
                                    </div>
                                )}
                                {userPrefs.showMargen && (
                                    <KpiCard label="Margen Contribución" value={`$${rentabilidadData.margenBruto.toLocaleString('es-AR')}`} color="var(--color-secondary)" />
                                )}
                                {userPrefs.showGastos && (
                                    <div onClick={() => setDrillDown({ tipo: 'gastos', label: 'Gastos Operativos' })} style={{ cursor: 'pointer' }}>
                                        <KpiCard label="Gastos Operativos" value={`$${rentabilidadData.totalGastos.toLocaleString('es-AR')}`} color="var(--color-danger)" />
                                    </div>
                                )}
                                {userPrefs.showMargen && (
                                    <KpiCard label="Margen EBITDA" value={`${rentabilidadData.margenEbitda.toFixed(2)}%`} color={rentabilidadData.margenEbitda >= 15 ? 'var(--color-success)' : 'var(--color-warning)'} />
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                                <div className="card" style={{ padding: 'var(--space-6)' }}>
                                    <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)' }}>Cascada de Resultados</h3>
                                    <div style={{ height: '300px' }}>
                                        {barData && <Bar data={barData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }} />}
                                    </div>
                                </div>
                                <div className="card" style={{ padding: 'var(--space-6)' }}>
                                    <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>Distribución de Gastos</h3>
                                    <div style={{ height: '240px', position: 'relative' }}>
                                        {pieData && <Doughnut data={pieData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'produccion' && userPrefs.showProduccion && (
                        <div onClick={() => setDrillDown({ tipo: 'lotes', label: 'Detalle de Lotes' })} style={{ cursor: 'pointer' }}>
                            <ProduccionReport data={produccionData} loading={loading && !produccionData} userPrefs={userPrefs} />
                        </div>
                    )}
                    {activeTab === 'produccion' && !userPrefs.showProduccion && (
                        <div className="empty-state">
                            <p>El reporte de producción está oculto según tus preferencias.</p>
                        </div>
                    )}
                </>
            )}

            <ReportSettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                userPrefs={userPrefs}
                onUpdatePrefs={handleUpdatePrefs}
                isAdmin={isAdmin}
                categories={metadata.categoriasGasto}
                onUpdateCategory={handleUpdateCategory}
                globalConfig={globalConfig}
                onUpdateGlobalConfig={handleUpdateGlobalConfig}
            />

            {drillDown && (
                <DrillDownModal 
                    {...drillDown} mes={mes} anio={anio} ubicacionId={ubicacionId}
                    onClose={() => setDrillDown(null)} 
                />
            )}
        </div>
    )
}
