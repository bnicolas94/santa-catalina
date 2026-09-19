export interface CajaLiquidacion {
    tipo: string
    nombre?: string | null
    activo: boolean
    ubicacionId?: string | null
    recibeDepositos?: boolean
    ubicacion?: { nombre?: string | null; activo?: boolean } | null
}

export interface EmpleadoCajaLiquidacion {
    ubicacionId?: string | null
}

export function cajasActivasParaLiquidacion(cajas: CajaLiquidacion[]) {
    return cajas.filter(caja => caja.activo && caja.ubicacion?.activo !== false)
}

function prioridadCaja(caja: CajaLiquidacion) {
    const nombre = `${caja.nombre || ''} ${caja.tipo}`.toLocaleLowerCase()
    if (!caja.recibeDepositos && nombre.includes('chica')) return 0
    if (!caja.recibeDepositos) return 1
    return 2
}

export function cajaSugeridaParaEmpleado(
    empleado: EmpleadoCajaLiquidacion | undefined,
    cajas: CajaLiquidacion[],
    cajaPredeterminada?: string,
) {
    const activas = cajasActivasParaLiquidacion(cajas)
    const deLaSede = empleado?.ubicacionId
        ? activas.filter(caja => caja.ubicacionId === empleado.ubicacionId).sort((a, b) => prioridadCaja(a) - prioridadCaja(b))
        : []

    if (deLaSede.length > 0) return deLaSede[0].tipo
    if (cajaPredeterminada && activas.some(caja => caja.tipo === cajaPredeterminada)) return cajaPredeterminada
    return [...activas].sort((a, b) => prioridadCaja(a) - prioridadCaja(b))[0]?.tipo || ''
}

