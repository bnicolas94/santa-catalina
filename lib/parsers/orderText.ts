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
        cantidad: number; // Cantidad de paquetes
        observaciones?: string;
    }>;
    unmatchedText?: string;
    isFullyMatched: boolean;
};

/**
 * Parsea el texto libre buscando patrones como "24jyq", "48esp", "96jyq", etc.
 * @param text - Texto a parsear
 * @param presentaciones - Lista de todas las presentaciones del sistema (con datos del producto)
 * @returns ParseResult con los IDs matcheados.
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
    }> = [];
    const unmatchedParts: string[] = [];
    let isFullyMatched = true;

    // Normalizamos el texto: a minusculas y removemos paréntesis
    let cleanText = text.toLowerCase().replace(/[()]/g, ' ');

    // Unimos números seguidos de letras que tengan un espacio en medio para que el regex los agarre
    // Ej: "48 clasicos" -> "48clasicos"
    cleanText = cleanText.replace(/(\d+)\s+([a-zñáéíóú]+)/g, '$1$2');
    
    // Separamos por espacios o barras y filtramos palabras de relleno
    const fillerWords = ['elegidos', 'de', 'surtidos', 'variados', 'puntos'];
    const tokens = cleanText.split(/[\s/]+/).filter(t => t && !fillerWords.includes(t));

    // Regex para detectar "[cantidad][codigo]" ej: "24jyq" o "48clasicos"
    const itemRegex = /^(\d+)([a-zñáéíóú]+)$/;
    // Regex para detectar "[codigo][cantidad]" ej: "jyq24" o "clasicos48"
    const itemRegexReverse = /^([a-zñáéíóú]+)(\d+)$/;

    const globalObservaciones: string[] = [];

    for (const token of tokens) {
        const match = token.match(itemRegex);
        const matchReverse = token.match(itemRegexReverse);

        if (match || matchReverse) {
            const cantidad = match ? parseInt(match[1], 10) : parseInt(matchReverse![2], 10);
            const aliasOcodigo = match ? match[2] : matchReverse![1];

            // 1. Filtrar presentaciones del producto que coincida con el código o alias
            const related = presentaciones.filter(p => {
                const matchesCodigo = p.producto.codigoInterno.toLowerCase() === aliasOcodigo.toLowerCase();
                const aliases = p.producto.alias ? p.producto.alias.split(/[\s,]+/).map(a => a.toLowerCase().trim()) : [];
                return matchesCodigo || aliases.includes(aliasOcodigo.toLowerCase());
            });

            if (related.length > 0) {
                // 2. Intentar match exacto (ej. 24jyq matches x24)
                let selectedPres = related.find(p => p.cantidad === cantidad);
                let numPaquetes = 1;

                if (!selectedPres) {
                    // 3. Buscar el divisor más grande posible (ej. 96jyq matches 2 x x48)
                    const sorted = [...related].sort((a, b) => b.cantidad - a.cantidad);
                    const divisor = sorted.find(p => cantidad % p.cantidad === 0);
                    if (divisor) {
                        selectedPres = divisor;
                        numPaquetes = cantidad / divisor.cantidad;
                    } else {
                        // 4. Fallback: usar el más grande disponible
                        selectedPres = sorted[0];
                        numPaquetes = cantidad / sorted[0].cantidad;
                    }
                }

                if (selectedPres) {
                    const isAlias = selectedPres.producto.codigoInterno.toLowerCase() !== aliasOcodigo.toLowerCase();
                    detalles.push({
                        presentacionId: selectedPres.id,
                        productoId: selectedPres.productoId,
                        cantidad: numPaquetes,
                        observaciones: isAlias ? aliasOcodigo.toUpperCase() : ""
                    });
                } else {
                    isFullyMatched = false;
                    unmatchedParts.push(token);
                }
            } else {
                isFullyMatched = false;
                unmatchedParts.push(token);
            }
        } else {
            // Tokens que no son [cant][cod], ej: "s/morron", "c/huevo", "bandejas"
            if (token.length > 2 && (token.startsWith('s/') || token.startsWith('c/') || token === 'p/n' || token === 'bandejas')) {
                globalObservaciones.push(token);
            } else {
                isFullyMatched = false;
                unmatchedParts.push(token);
            }
        }
    }

    // Aplicar observaciones globales a todos los detalles
    if (globalObservaciones.length > 0 && detalles.length > 0) {
        const obs = globalObservaciones.join(" ");
        detalles.forEach(d => {
            d.observaciones = d.observaciones ? `${d.observaciones} ${obs}` : obs;
        });
    }

    return {
        detalles,
        isFullyMatched,
        unmatchedText: isFullyMatched ? undefined : tokens.join(" ")
    };
}
