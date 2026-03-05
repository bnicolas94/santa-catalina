export type PresentacionData = {
    id: string;
    cantidad: number;
    producto: {
        codigoInterno: string;
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

    // Normalizamos el texto: a minusculas y separamos por espacios o barras
    // Ej: "24jyq / 8hue 8tom p/n" -> ["24jyq", "/", "8hue", "8tom", "p/n"]
    const tokens = text.toLowerCase().split(/[\s/]+/);

    // Regex para detectar "[cantidad][codigo]" ej: "24jyq" -> match[1]="24", match[2]="jyq"
    const itemRegex = /^(\d+)([a-zA-Z]+)$/;

    const currentObservaciones: string[] = [];

    for (const token of tokens) {
        if (!token) continue;

        const match = token.match(itemRegex);

        if (match) {
            const cantidad = parseInt(match[1], 10);
            const codigoInterno = match[2];

            // Buscamos si existe la presentación exacta
            const presentacionStr = presentaciones.find(
                (p) =>
                    p.cantidad === cantidad &&
                    p.producto.codigoInterno.toLowerCase() === codigoInterno
            );

            if (presentacionStr) {
                detalles.push({
                    presentacionId: presentacionStr.id,
                    cantidad: 1, // 1 pack de esa presentacion
                    observaciones: "", // Las llenamos al final si hay
                });
            } else {
                // Encontramos el patrón pero no existe esa combinación exacta en DB
                isFullyMatched = false;
                unmatchedParts.push(token);
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

    // Si hubo observaciones globales, se las aplicamos al primer detalle (u a todos)
    const obsString = currentObservaciones.join(" ");
    if (obsString && detalles.length > 0) {
        detalles.forEach((d) => (d.observaciones = obsString));
    } else if (obsString) {
        unmatchedParts.push(obsString);
    }

    // Si no logramos procesar algo, devolvemos isFullyMatched = false
    return {
        detalles: isFullyMatched ? detalles : [],
        isFullyMatched,
        unmatchedText: isFullyMatched ? undefined : text, // Devolvemos todo el texto original para carga manual
    };
}
