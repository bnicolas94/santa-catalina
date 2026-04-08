// components/produccion/v2/ProduccionContext.tsx
'use client'

import React, { createContext, useContext, useState } from 'react'
import { Producto, Ubicacion, Coordinador, Lote, PlanningData, StockProd } from './types'

interface ProduccionContextType {
    filterFecha: string
    setFilterFecha: (fecha: string) => void
    productos: Producto[]
    ubicaciones: Ubicacion[]
    coordinadores: Coordinador[]
    lotes: Lote[]
    planning: PlanningData | null
    stockProductos: StockProd[]
    loading: boolean
    mutate: () => void
    
    // UI States
    showModal: boolean
    setShowModal: (show: boolean) => void
    error: string
    setError: (err: string) => void
    success: string
    setSuccess: (msg: string) => void
}

const ProduccionContext = createContext<ProduccionContextType | undefined>(undefined)

export const ProduccionProvider: React.FC<{ 
    children: React.ReactNode, 
    value: any // Passing initial SWR data and basic setters
}> = ({ children, value }) => {
    return (
        <ProduccionContext.Provider value={value}>
            {children}
        </ProduccionContext.Provider>
    )
}

export const useProduccion = () => {
    const context = useContext(ProduccionContext)
    if (!context) throw new Error('useProduccion must be used within a ProduccionProvider')
    return context
}
