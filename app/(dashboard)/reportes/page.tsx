'use client'

import { useState, useEffect } from 'react'
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    LineElement, PointElement, Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js'

import PeriodoSelector, { type SeccionReporte } from './components/PeriodoSelector'
import DrillDownModal from './components/DrillDownModal'
import ReportSettingsModal from './components/ReportSettingsModal'

import DashboardSection from './sections/DashboardSection'
import ProduccionSection from './sections/ProduccionSection'
import VentasSection from './sections/VentasSection'
import CostosSection from './sections/CostosSection'
import DesperdicioSection from './sections/DesperdicioSection'
import PerformanceSection from './sections/PerformanceSection'

import { exportReportToExcel } from './utils/exportUtils'
import { useSession } from 'next-auth/react'
import { GranularidadTemporal, RangoFechas, getDateRange } from './utils/dateUtils'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement, Filler)

// --- Interfaces ---
interface RentabilidadData {
    desde: string
    hasta: string
    ingresosTotales: number
    costoMercaderiaVendida: number
    margenBruto: number
    totalGastos: number
    rentabilidadNeta: number
    margenEbitda: number
    gastosPorCategoria: Record<string, number>
}

interface ProduccionData {
    desde: string
    hasta: string
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

    // --- State ---
    const [activeSection, setActiveSection] = useState<SeccionReporte>('dashboard')
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

    const [granularidad, setGranularidad] = useState<GranularidadTemporal>('mes')
    const [rangoFechas, setRangoFechas] = useState<RangoFechas>(() => getDateRange('mes'))
    const [ubicacionId, setUbicacionId] = useState('')
    const [incluirTodosLosEstados, setIncluirTodosLosEstados] = useState(false)

    const [drillDown, setDrillDown] = useState<{
        tipo: 'pedidos' | 'gastos' | 'lotes',
        label: string,
        categoriaId?: string
    } | null>(null)

    // --- Effects ---
    useEffect(() => {
        fetchMetadata()
        fetchPrefs()
        fetchConfig()
    }, [])

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangoFechas.desde.toISOString(), rangoFechas.hasta.toISOString(), ubicacionId, activeSection, incluirTodosLosEstados])

    // --- Data fetching ---
    async function fetchMetadata() {
        try {
            const res = await fetch('/api/reportes/metadata')
            const json = await res.json()
            setMetadata(json)
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
                if (json.incluirTodo !== undefined) setIncluirTodosLosEstados(json.incluirTodo)
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
                desde: rangoFechas.desde.toISOString(),
                hasta: rangoFechas.hasta.toISOString(),
                ...(ubicacionId && { ubicacionId }),
                ...(refresh && { refresh: 'true' }),
                ...(incluirTodosLosEstados && { todos: 'true' })
            })

            // Dashboard needs both datasets; other sections need specific ones
            const needsRentabilidad = activeSection === 'dashboard' || activeSection === 'costos'
            const needsProduccion = activeSection === 'dashboard' || activeSection === 'produccion' || activeSection === 'desperdicio'

            const promises: Promise<any>[] = []

            if (needsRentabilidad) {
                promises.push(
                    fetch(`/api/reportes/rentabilidad?${params}`).then(async res => {
                        if (res.status === 403) throw new Error('forbidden')
                        if (!res.ok) throw new Error('Error al obtener rentabilidad')
                        return { tipo: 'rentabilidad', data: await res.json() }
                    })
                )
            }

            if (needsProduccion) {
                promises.push(
                    fetch(`/api/reportes/produccion?${params}`).then(async res => {
                        if (res.status === 403) throw new Error('forbidden')
                        if (!res.ok) throw new Error('Error al obtener producción')
                        return { tipo: 'produccion', data: await res.json() }
                    })
                )
            }

            const results = await Promise.all(promises)

            for (const result of results) {
                if (result.tipo === 'rentabilidad') setRentabilidadData(result.data)
                if (result.tipo === 'produccion') setProduccionData(result.data)
            }
        } catch (err: any) {
            if (err?.message === 'forbidden') {
                setError('No tienes permisos para ver este reporte.')
            } else {
                console.error('Error fetching reporte:', err)
                setError('Ocurrió un error al cargar el reporte.')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleExport = async () => {
        const params = new URLSearchParams({ 
            desde: rangoFechas.desde.toISOString(), 
            hasta: rangoFechas.hasta.toISOString(), 
            ...(ubicacionId && { ubicacionId }),
            ...(incluirTodosLosEstados && { todos: 'true' })
        })
        const mesTag = String(rangoFechas.desde.getMonth() + 1)
        const anioTag = String(rangoFechas.desde.getFullYear())

        if (activeSection === 'produccion' && produccionData) {
            exportReportToExcel(produccionData, 'produccion', mesTag, anioTag)
        } else if (activeSection === 'dashboard' && rentabilidadData) {
            exportReportToExcel(rentabilidadData, 'economico', mesTag, anioTag)
        } else if (activeSection === 'ventas') {
            try {
                const res = await fetch(`/api/reportes/ventas?${params}`)
                if (res.ok) exportReportToExcel(await res.json(), 'ventas', mesTag, anioTag)
            } catch (err) { console.error('Error exporting ventas:', err) }
        } else if (activeSection === 'costos') {
            try {
                const res = await fetch(`/api/reportes/costos?${params}`)
                if (res.ok) exportReportToExcel(await res.json(), 'costos', mesTag, anioTag)
            } catch (err) { console.error('Error exporting costos:', err) }
        } else if (activeSection === 'desperdicio') {
            try {
                const res = await fetch(`/api/reportes/desperdicio?${params}`)
                if (res.ok) exportReportToExcel(await res.json(), 'desperdicio', mesTag, anioTag)
            } catch (err) { console.error('Error exporting desperdicio:', err) }
        } else if (activeSection === 'performance') {
            try {
                const res = await fetch(`/api/reportes/performance?${params}`)
                if (res.ok) exportReportToExcel(await res.json(), 'performance', mesTag, anioTag)
            } catch (err) { console.error('Error exporting performance:', err) }
        }
    }

    const handleDrillDown = (tipo: string, label: string) => {
        setDrillDown({ tipo: tipo as 'pedidos' | 'gastos' | 'lotes', label })
    }

    // --- Render ---
    return (
        <div className="fade-in">
            <PeriodoSelector
                granularidad={granularidad} rango={rangoFechas} ubicacionId={ubicacionId}
                activeSection={activeSection} loading={loading}
                ubicaciones={metadata.ubicaciones} anios={metadata.years}
                incluirTodo={incluirTodosLosEstados}
                onIncluirTodoChange={(val: boolean) => {
                    setIncluirTodosLosEstados(val)
                    handleUpdatePrefs({ ...userPrefs, incluirTodo: val })
                }}
                onGranularidadChange={setGranularidad} onRangoChange={setRangoFechas}
                onUbicacionChange={setUbicacionId} onSectionChange={setActiveSection}
                onRefresh={() => fetchData(true)} onExport={handleExport}
                onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {error ? (
                <div className="empty-state"><p style={{ color: 'var(--color-danger)' }}>{error}</p></div>
            ) : (
                <>
                    {activeSection === 'dashboard' && (
                        <DashboardSection
                            rango={rangoFechas} ubicacionId={ubicacionId}
                            rentabilidadData={rentabilidadData}
                            produccionData={produccionData}
                            loading={loading}
                            onDrillDown={handleDrillDown}
                        />
                    )}

                    {activeSection === 'produccion' && (
                        <ProduccionSection
                            data={produccionData}
                            loading={loading}
                            userPrefs={userPrefs}
                            onDrillDown={handleDrillDown}
                        />
                    )}

                    {activeSection === 'ventas' && (
                        <VentasSection rango={rangoFechas} ubicacionId={ubicacionId} incluirTodo={incluirTodosLosEstados} />
                    )}

                    {activeSection === 'costos' && (
                        <CostosSection rango={rangoFechas} ubicacionId={ubicacionId} incluirTodo={incluirTodosLosEstados} />
                    )}

                    {activeSection === 'desperdicio' && (
                        <DesperdicioSection rango={rangoFechas} ubicacionId={ubicacionId} incluirTodo={incluirTodosLosEstados} />
                    )}

                    {activeSection === 'performance' && (
                        <PerformanceSection rango={rangoFechas} ubicacionId={ubicacionId} incluirTodo={incluirTodosLosEstados} />
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
                    {...drillDown} desdeIso={rangoFechas.desde.toISOString()} hastaIso={rangoFechas.hasta.toISOString()} ubicacionId={ubicacionId}
                    incluirTodo={incluirTodosLosEstados}
                    onClose={() => setDrillDown(null)}
                />
            )}
        </div>
    )
}
