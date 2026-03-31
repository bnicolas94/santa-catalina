import useSWR from 'swr'

interface UseProduccionDataProps {
    fecha: string
}

const fetcher = async ([_, fecha]: [string, string]) => {
    const [lotesRes, prodRes, empRes, stockRes, movRes, ubiRes, planRes] = await Promise.all([
        fetch('/api/lotes'),
        fetch('/api/productos'),
        fetch('/api/empleados'),
        fetch('/api/stock-producto'),
        fetch('/api/movimientos-producto?limit=10'),
        fetch('/api/ubicaciones'),
        fetch(`/api/produccion/planificacion?fecha=${fecha || new Date().toISOString().slice(0, 10)}`)
    ])

    if (!lotesRes.ok || !prodRes.ok || !empRes.ok || !stockRes.ok || !movRes.ok || !ubiRes.ok || !planRes.ok) {
        throw new Error('Error al cargar datos')
    }

    const [lotes, productos, empleados, stockProductos, movimientos, ubicaciones, planning] = await Promise.all([
        lotesRes.json(),
        prodRes.json(),
        empRes.json(),
        stockRes.json(),
        movRes.json(),
        ubiRes.json(),
        planRes.json()
    ])

    return {
        lotes: Array.isArray(lotes) ? lotes : [],
        productos: Array.isArray(productos) ? productos : [],
        coordinadores: Array.isArray(empleados) ? empleados.filter((e: any) => ['ADMIN', 'COORD_PROD', 'LOCAL'].includes(e.rol) && e.activo) : [],
        stockProductos: Array.isArray(stockProductos) ? stockProductos : [],
        movimientos: Array.isArray(movimientos) ? movimientos : [],
        ubicaciones: Array.isArray(ubicaciones) ? ubicaciones : [],
        planning: planning && !planning.error ? planning : null
    }
}

export function useProduccionData(fecha: string) {
    const { data, error, isLoading, mutate } = useSWR(['produccion-data', fecha], fetcher, {
        refreshInterval: 15000, 
        revalidateOnFocus: true,
        keepPreviousData: true
    })

    return {
        data,
        isLoading,
        isError: error,
        mutate
    }
}
