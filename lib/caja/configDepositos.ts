import { prisma } from '@/lib/prisma'

export interface ConfigDepositoUbicacion {
    cajaDepositoId: string
    conceptoDeposito: string
    habilitarDeposito: boolean
}

export type ConfigDepositos = Record<string, ConfigDepositoUbicacion>

// La clave es el ID de sede: cada local tiene su propia caja de depósitos.
export async function leerConfigDepositos(): Promise<ConfigDepositos> {
    const cajas = await prisma.saldoCaja.findMany({ where: { activo: true, recibeDepositos: true, ubicacion: { activo: true } } })
    return Object.fromEntries(cajas.filter(c => c.ubicacionId).map(c => [c.ubicacionId!, {
        cajaDepositoId: c.tipo, conceptoDeposito: c.conceptoDeposito, habilitarDeposito: true,
    }]))
}
