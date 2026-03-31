// components/produccion/v2/types.ts

export interface Producto {
    id: string
    nombre: string
    codigoInterno: string
    planchasPorPaquete: number
    paquetesPorRonda: number
    presentaciones?: { id: string, cantidad: number }[]
}

export interface StockProd {
    productoId: string
    presentacionId: string
    nombre: string
    codigoInterno: string
    planchasPorPaquete: number
    cantidadPresentacion: number
    fabrica: number
    local: number
    stockMinimo: number
    ubicaciones?: Record<string, number>
}

export interface Ubicacion {
    id: string
    nombre: string
    tipo: string
}

export interface Coordinador {
    id: string
    nombre: string
}

export interface Lote {
    id: string
    fechaProduccion: string
    horaInicio: string | null
    horaFin: string | null
    unidadesProducidas: number // paquetes
    unidadesRechazadas: number
    motivoRechazo: string | null
    empleadosRonda: number
    estado: string
    producto: Producto
    coordinador: Coordinador | null
    ubicacion: Ubicacion | null
}

export interface PlanningData {
    necesidades: Record<string, Record<string, number>>
    infoProductos: Record<string, any>
    manuales?: Record<string, Record<string, number>>
    manualesDetalle?: Record<string, Record<string, { fabrica: number, local: number }>>
    stockFabricacion: Record<string, number>
    stockLocal: Record<string, number>
    enProduccion: Record<string, number>
    shipmentCounts?: Record<string, number>
    descuentosRealizados?: string[]
}

export const ESTADOS_LOTE = [
    { value: 'en_produccion', label: 'En producción', color: '#F39C12', emoji: '🔧' },
    { value: 'en_camara', label: 'En cámara', color: '#3498DB', emoji: '❄️' },
    { value: 'distribuido', label: 'Distribuido', color: '#2ECC71', emoji: '✅' },
    { value: 'merma', label: 'Merma', color: '#E74C3C', emoji: '⚠️' },
    { value: 'vencido', label: 'Vencido', color: '#95A5A6', emoji: '🕐' },
]

export function getEstadoInfo(estado: string) {
    return ESTADOS_LOTE.find((e) => e.value === estado) || { value: estado, label: estado, color: '#607D8B', emoji: '❓' }
}
