import { prisma } from '@/lib/prisma'

export interface ConfigDepositoUbicacion {
    cajaOrigenId: string
    cajaRecepcionId: string
    conceptoDeposito: string
    habilitarDeposito: boolean
}

export type ConfigDepositos = Record<string, ConfigDepositoUbicacion>

interface CajaConfigDeposito {
    tipo: string
    nombre: string | null
    ubicacionId: string | null
    recibeDepositos: boolean
    conceptoDeposito: string
}

export function construirConfigDepositos(cajas: CajaConfigDeposito[]): ConfigDepositos {
    const cajasPorSede = new Map<string, CajaConfigDeposito[]>()
    for (const caja of cajas) {
        if (!caja.ubicacionId) continue
        const grupo = cajasPorSede.get(caja.ubicacionId) || []
        grupo.push(caja)
        cajasPorSede.set(caja.ubicacionId, grupo)
    }

    const configuraciones: ConfigDepositos = {}
    for (const [ubicacionId, grupo] of cajasPorSede) {
        const recepcion = grupo.find(caja => caja.recibeDepositos)
        const origen = grupo.find(caja => !caja.recibeDepositos && /chica/i.test(`${caja.nombre || ''} ${caja.tipo}`))
            || grupo.find(caja => !caja.recibeDepositos)
        if (!recepcion || !origen) continue
        configuraciones[ubicacionId] = {
            cajaOrigenId: origen.tipo,
            cajaRecepcionId: recepcion.tipo,
            conceptoDeposito: recepcion.conceptoDeposito,
            habilitarDeposito: true,
        }
    }

    return configuraciones
}

// La clave es el ID de sede: cada sede deposita desde su Caja Chica hacia su Caja Fuerte.
export async function leerConfigDepositos(): Promise<ConfigDepositos> {
    const cajas = await prisma.saldoCaja.findMany({
        where: { activo: true, ubicacion: { activo: true } },
        orderBy: [{ nombre: 'asc' }, { tipo: 'asc' }],
    })
    return construirConfigDepositos(cajas)
}
