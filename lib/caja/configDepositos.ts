import fs from 'fs/promises'
import path from 'path'

export interface ConfigDepositoUbicacion {
    cajaDepositoId: string
    conceptoDeposito: string
    habilitarDeposito: boolean
}

export type ConfigDepositos = Record<string, ConfigDepositoUbicacion>

const CONFIG_PATH = path.join(process.cwd(), 'config', 'caja-depositos.json')

export async function leerConfigDepositos(): Promise<ConfigDepositos> {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8')
        return JSON.parse(data) as ConfigDepositos
    } catch (error) {
        console.error('Error reading caja config:', error)
        return {}
    }
}

export async function guardarConfigDepositos(config: ConfigDepositos): Promise<void> {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}
