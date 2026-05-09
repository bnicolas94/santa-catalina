/**
 * Utilidades para el cálculo de horas trabajadas y extras.
 */

export interface Marca {
    fechaHora: string | Date;
    tipo: 'entrada' | 'salida' | 'ausencia';
    tipoLicencia?: {
        conGoceSueldo: boolean;
    };
}

export interface ResumenDia {
    horasTrabajadas: number;
    horasExtras: number;
    esAusencia: boolean;
    marcas: Marca[];
}

/**
 * Calcula el resumen de un día basado en sus marcas.
 * Asume que las marcas están ordenadas cronológicamente.
 */
export function calcularResumenDia(marcas: Marca[], horasJornada: number = 8): ResumenDia {
    let milisegundosTrabajados = 0;
    let esAusencia = marcas.some(m => m.tipo === 'ausencia');
    let esAusenciaRemunerada = marcas.some(m => m.tipo === 'ausencia' && m.tipoLicencia?.conGoceSueldo);

    if (esAusencia) {
        return { 
            horasTrabajadas: esAusenciaRemunerada ? horasJornada : 0, 
            horasExtras: 0, 
            esAusencia: true, 
            marcas 
        };
    }

    // Ordenar por seguridad
    const marcasOrdenadas = [...marcas].sort((a, b) =>
        new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()
    );

    let entradaActual: Date | null = null;

    for (const marca of marcasOrdenadas) {
        if (marca.tipo === 'entrada') {
            entradaActual = new Date(marca.fechaHora);
        } else if (marca.tipo === 'salida' && entradaActual) {
            const salida = new Date(marca.fechaHora);
            milisegundosTrabajados += (salida.getTime() - entradaActual.getTime());
            entradaActual = null;
        }
    }

    const horasTrabajadas = milisegundosTrabajados / (1000 * 60 * 60);
    const horasExtras = Math.max(0, horasTrabajadas - horasJornada);

    return {
        horasTrabajadas: parseFloat(horasTrabajadas.toFixed(2)),
        horasExtras: parseFloat(horasExtras.toFixed(2)),
        esAusencia: false,
        marcas: marcasOrdenadas
    };
}

/**
 * Agrupa fichadas por fecha (YYYY-MM-DD) usando tiempo local para evitar desfases de zona horaria.
 */
export function agruparFichadasPorDia(fichadas: any[]): Record<string, any[]> {
    const grupos: Record<string, any[]> = {};

    fichadas.forEach(f => {
        const d = new Date(f.fechaHora);
        // Usamos métodos UTC para evitar desfases de zona horaria del servidor
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        const fechaUTC = `${year}-${month}-${day}`;

        if (!grupos[fechaUTC]) grupos[fechaUTC] = [];
        grupos[fechaUTC].push(f);
    });

    // Ordenamos las marcas dentro de cada día cronológicamente
    Object.keys(grupos).forEach(dia => {
        grupos[dia].sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());
    });

    return grupos;
}
