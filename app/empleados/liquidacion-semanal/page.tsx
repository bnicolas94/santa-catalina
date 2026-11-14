'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { WeeklyPayrollModal } from '@/components/empleados/WeeklyPayrollModal'
import type { EmpleadoLiquidable } from '@/components/empleados/weeklyPayroll.types'
import { ordenarEmpleadosPorApellido } from '@/lib/rrhh/nombres-empleados'

export default function LiquidacionSemanalPage() {
    const router = useRouter()
    const [empleados, setEmpleados] = useState<EmpleadoLiquidable[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let activo = true
        const cargar = async () => {
            try {
                const respuesta = await fetch('/api/empleados')
                const data = await respuesta.json()
                if (!respuesta.ok) throw new Error(data?.error || 'No se pudo cargar el personal.')
                if (!Array.isArray(data)) throw new Error('La respuesta de empleados no es válida.')
                if (activo) setEmpleados(data)
            } catch (fetchError) {
                if (activo) setError(fetchError instanceof Error ? fetchError.message : 'No se pudo cargar el personal.')
            } finally {
                if (activo) setLoading(false)
            }
        }
        void cargar()
        return () => { activo = false }
    }, [])

    const empleadosOrdenados = useMemo(() => ordenarEmpleadosPorApellido(empleados), [empleados])

    if (loading) return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-gray-500)' }}>Cargando liquidación semanal…</div>
    if (error) return <div style={{ padding: 'var(--space-6)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-lg)' }}>{error}</div>

    return <WeeklyPayrollModal
        mode="page"
        empleados={empleadosOrdenados}
        onClose={() => router.push('/empleados')}
        onSuccess={() => router.refresh()}
    />
}
