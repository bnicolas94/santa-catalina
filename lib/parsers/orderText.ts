export type PresentacionData = {
    id: string;
    cantidad: number;
    producto: {
        codigoInterno: string;
        alias?: string | null;
    };
};

export type ParseResult = {
    detalles: Array<{
        presentacionId: string;
        cantidad: number; // Siempre 1 para el pedido, la "cantidad de planchas" está en la presentacion
        observaciones?: string;
    }>;
    unmatchedText?: string;
    isFullyMatched: boolean;
};

/**
 * Parsea el texto libre de un pedido de Excel buscando patrones como "24jyq", "48esp", etc.
 * @param text - Texto del pedido en Excel, ej: "24jyq / 8hue 8tom"
 * @param presentaciones - Lista de todas las presentaciones activas en el sistema
 * @returns ParseResult con los IDs matcheados o el texto no reconocido.
 */
export function parseOrderText(
    text: string,
    presentaciones: PresentacionData[]
): ParseResult {
    if (!text) {
        return { detalles: [], isFullyMatched: false, unmatchedText: "Texto vacío" };
    }

    const detalles = [];
    const unmatchedParts = [];
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
    // Incluimos ñ y acentos
    const itemRegex = /^(\d+)([a-zñáéíóú]+)$/;

    const currentObservaciones: string[] = [];

    for (const token of tokens) {
        if (!token) continue;

        const match = token.match(itemRegex);

        if (match) {
            const cantidad = parseInt(match[1], 10);
            const codigoInterno = match[2];

            // Buscamos si existe la presentación exacta
            const exactMatch = presentaciones.find(
                (p) => {
                    const matchesCodigo = p.producto.codigoInterno.toLowerCase() === codigoInterno;
                    const aliases = p.producto.alias ? p.producto.alias.split(/[\s,]+/).map(a => a.toLowerCase()) : [];
                    const matchesAlias = aliases.includes(codigoInterno);
                    
                    return p.cantidad === cantidad && (matchesCodigo || matchesAlias);
                }
            );

            if (exactMatch) {
                const isAlias = exactMatch.producto.codigoInterno.toLowerCase() !== codigoInterno.toLowerCase();
                const detailObs = isAlias ? codigoInterno.toUpperCase() : "";

                detalles.push({
                    presentacionId: exactMatch.id,
                    cantidad: 1, 
                    observaciones: detailObs, 
                });
            } else {
                // Si no hay match exacto, buscamos si la cantidad es múltiplo de alguna presentación
                // Filtramos presentaciones que coincidan con el código/alias
                const related = presentaciones.filter(p => {
                    const matchesCodigo = p.producto.codigoInterno.toLowerCase() === codigoInterno;
                    const aliases = p.producto.alias ? p.producto.alias.split(/[\s,]+/).map(a => a.toLowerCase()) : [];
                    return matchesCodigo || aliases.includes(codigoInterno);
                }).sort((a, b) => b.cantidad - a.cantidad); // Ordenamos de mayor a menor para usar el paquete más grande

                const divisor = related.find(p => cantidad % p.cantidad === 0);

                if (divisor) {
                    const isAlias = divisor.producto.codigoInterno.toLowerCase() !== codigoInterno.toLowerCase();
                    const detailObs = isAlias ? codigoInterno.toUpperCase() : "";

                    detalles.push({
                        presentacionId: divisor.id,
                        cantidad: cantidad / divisor.cantidad,
                        observaciones: detailObs,
                    });
                } else {
                    // Encontramos el patrón pero no hay forma de cubrir esa cantidad con presentaciones existentes
                    isFullyMatched = false;
                    unmatchedParts.push(token);
                }
            }
        } else {
            // Si no hace match con "[CANTIDAD][CODIGO]", lo consideramos una observacion o unmatched
            // Consideramos tokens estándar "s/algo" (sin), "c/algo" (con), "p/n" (para noche)
            if (token.startsWith('s/') || token.startsWith('c/') || token === 'p/n' || token === 'bandejas') {
                currentObservaciones.push(token);
            } else {
                // Token desconocido que no logramos matchear del todo
                // Si hay una estandarización a futuro, los tokens raros hacen que la fila sea manual.
                isFullyMatched = false;
                unmatchedParts.push(token);
            }
        }
    }

    // Si hubo observaciones globales, se las sumamos a todos los detalles
    const obsString = currentObservaciones.join(" ");
    if (obsString && detalles.length > 0) {
        detalles.forEach((d) => {
            d.observaciones = d.observaciones ? `${d.observaciones} ${obsString}` : obsString;
        });
    } else if (obsString) {
        unmatchedParts.push(obsString);
    }

    // Si no logramos procesar algo, devolvemos isFullyMatched = false
    return {
        detalles: detalles,
        isFullyMatched,
        unmatchedText: isFullyMatched ? undefined : text, // Devolvemos todo el texto original para carga manual
    };
}
