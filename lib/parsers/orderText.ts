export type PresentacionData = {
    id: string;
    cantidad: number;
    productoId: string;
    producto: {
        id: string;
        codigoInterno: string;
        alias?: string | null;
    };
};

export type ParseResult = {
    detalles: Array<{
        presentacionId: string;
        productoId: string;
        productoNombre?: string;
        cantidad: number; // Cantidad de paquetes de esa presentación
        observaciones?: string;
        nroPack?: number;
    }>;
    unmatchedText?: string;
    isFullyMatched: boolean;
    esRetiro?: boolean;
};

/**
 * Parsea el texto libre buscando patrones como "24jyq", "48esp", "96jyq", etc.
 * Implementa la lógica de bultos físicos (Packs).
 * @param text - Texto a parsear
 * @param presentaciones - Lista de todas las presentaciones del sistema (con datos del producto)
 * @returns ParseResult con los IDs matcheados y numeración de packs.
 */
export function parseOrderText(
    text: string,
    presentaciones: PresentacionData[]
): ParseResult {
    if (!text) {
        return { detalles: [], isFullyMatched: false, unmatchedText: "Texto vacío" };
    }

    const detalles: Array<{
        presentacionId: string;
        productoId: string;
        cantidad: number;
        observaciones?: string;
        nroPack?: number;
    }> = [];
    
    // Normalizamos el texto: a minusculas y removemos paréntesis
    let cleanText = text.toLowerCase().replace(/[()]/g, ' ');
    cleanText = cleanText.replace(/(\d+)\s+([a-zñáéíóú]+)/g, '$1$2');
    
    const fillerWords = ['elegidos', 'de', 'surtidos', 'variados', 'puntos'];
    const tokens = cleanText.split(/[\s/]+/).filter(t => t && !fillerWords.includes(t));

    const itemRegex = /^(\d+)([a-zñáéíóú]+)$/;
    const itemRegexReverse = /^([a-zñáéíóú]+)(\d+)$/;

    const globalObservaciones: string[] = [];
    const unmatchedParts: string[] = [];
    let isFullyMatched = true;
    let esRetiro = false;

    // Variables para control de packs
    let nextPackNro = 1;
    let currentMixedPackNro: number | null = null;
    let currentMixedPackUnits = 0;

    for (const token of tokens) {
        const match = token.match(itemRegex);
        const matchReverse = token.match(itemRegexReverse);

        if (match || matchReverse) {
            const cantidadTotalToken = match ? parseInt(match[1], 10) : parseInt(matchReverse![2], 10);
            const aliasOcodigo = (match ? match[2] : matchReverse![1]).toLowerCase();

            // 1. Buscar todas las presentaciones de cualquier producto que coincida por código o alias.
            // Esto permite recolectar candidatos de "Elegidos" y productos individuales simultáneamente.
            const related = presentaciones.filter(p => {
                const codeMatch = p.producto.codigoInterno.toLowerCase() === aliasOcodigo;
                const aliases = (p.producto.alias || "").split(/[\s,]+/).map(a => a.toLowerCase().trim());
                const aliasMatch = aliases.includes(aliasOcodigo);
                return codeMatch || aliasMatch;
            });

            if (related.length > 0) {
                // Ordenar por cantidad descendente para el algoritmo greedy, pero...
                // Prioridad Crucial: Si dos productos ofrecen el mismo tamaño de pack (ej. J&Q 24 y Elegidos 24)
                // priorizamos 'Elegidos' (ELE) por requerimiento explícito del usuario para resolver conflictos de alias.
                const sorted = [...related].sort((a, b) => {
                    if (b.cantidad !== a.cantidad) {
                        return b.cantidad - a.cantidad;
                    }
                    // Prioridad Crucial: Si dos productos ofrecen el mismo tamaño de pack (ej. J&Q 24 y Elegidos 24)
                    // preferimos el producto específico (JQ, ESP) y dejamos 'Elegidos' (ELE) al final.
                    if (a.producto.codigoInterno === 'ELE') return 1;
                    if (b.producto.codigoInterno === 'ELE') return -1;
                    return 0;
                });
                let remaining = cantidadTotalToken;
                const initialDetallesLength = detalles.length;

                while (remaining > 0) {
                    const pres = sorted.find(p => p.cantidad <= remaining);
                    if (!pres) {
                        isFullyMatched = false;
                        unmatchedParts.push(token);
                        detalles.splice(initialDetallesLength); // Revertir
                        remaining = 0;
                        break;
                    }

                    const isAlias = pres.producto.codigoInterno.toLowerCase() !== aliasOcodigo;
                    const cod = pres.producto.codigoInterno.toUpperCase();
                    
                    let nroPack: number | undefined;

                    // LÓGICA DE PACKS CERRADOS
                    const isJYQ = cod.includes("JYQ") || aliasOcodigo.includes("jyq");
                    const isCL = cod.includes("CL") || aliasOcodigo.includes("cl");
                    const isES = cod.includes("ES") || aliasOcodigo.includes("es");

                    const isClosed48 = pres.cantidad === 48 && (isJYQ || isCL || isES);
                    const isClosed24JYQ = pres.cantidad === 24 && isJYQ;

                    if (isClosed48 || isClosed24JYQ) {
                        nroPack = nextPackNro++;
                    } else if (pres.cantidad % 8 === 0) {
                        // LÓGICA DE "RARITOS" (Múltiplo de 8)
                        if (currentMixedPackNro && (currentMixedPackUnits + pres.cantidad <= 48)) {
                            nroPack = currentMixedPackNro;
                            currentMixedPackUnits += pres.cantidad;
                        } else {
                            currentMixedPackNro = nextPackNro++;
                            currentMixedPackUnits = pres.cantidad;
                            nroPack = currentMixedPackNro;
                        }
                        
                        if (currentMixedPackUnits >= 48) {
                            currentMixedPackNro = null;
                            currentMixedPackUnits = 0;
                        }
                    }

                    detalles.push({
                        presentacionId: pres.id,
                        productoId: pres.productoId,
                        cantidad: 1, // Desglosamos por unidad de presentación
                        observaciones: isAlias ? aliasOcodigo.toUpperCase() : "",
                        nroPack
                    });

                    remaining -= pres.cantidad;
                }
            } else {
                isFullyMatched = false;
                unmatchedParts.push(token);
            }
        } else {
            if (token.length > 2 && (token.startsWith('s/') || token.startsWith('c/') || token === 'p/n' || token === 'bandejas')) {
                globalObservaciones.push(token);
            } else if (token.includes('retira') || token.includes('retiro')) {
                esRetiro = true;
            } else {
                isFullyMatched = false;
                unmatchedParts.push(token);
            }
        }
    }

    if (globalObservaciones.length > 0 && detalles.length > 0) {
        const obs = globalObservaciones.join(" ");
        detalles.forEach(d => {
            d.observaciones = d.observaciones ? `${d.observaciones} ${obs}` : obs;
        });
    }

    return {
        detalles,
        isFullyMatched,
        unmatchedText: isFullyMatched ? undefined : unmatchedParts.join(" "),
        esRetiro
    };
}
