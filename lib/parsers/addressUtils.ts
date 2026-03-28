/**
 * Utility to parse and standardize addresses
 */

export interface ParsedAddress {
    calle: string | null;
    numero: string | null;
    full: string | null;
}

export function parseDireccion(dir: string | null, loc: string | null): ParsedAddress {
    if (!dir) return { calle: null, numero: null, full: null };
    
    let tempCalle = dir.trim();
    let numero = null;

    // Detect N°, N, #, etc. followed by numbers
    const match = dir.match(/^(.*?)\s+(?:N°|N|#|nro|num|altura)\.?\s*(\d+.*)$/i);
    if (match) {
        tempCalle = match[1].trim();
        numero = match[2].trim();
    } else {
        // Fallback: If no N°, check if it ends with a sequence of numbers (e.g. "Calle 152 5639")
        // We look for a space followed by digits at the end
        const simpleMatch = dir.match(/^(.*?)\s+(\d+)$/);
        if (simpleMatch) {
            tempCalle = simpleMatch[1].trim();
            numero = simpleMatch[2].trim();
        }
    }

    if (numero) {
        // Strip "entre calles" from numero if present (e.g. "5639 e/ 56 y 57" -> "5639")
        const entreMatch = numero.match(/^(.*?)\s+(?:e\/|entre|esq\.?|esquina)\s+.*$/i);
        if (entreMatch) {
            numero = entreMatch[1].trim();
        }
    }

    // Add "Calle" prefix if it starts with a digit and doesn't have it
    if (/^\d/.test(tempCalle) && !/^calle\s/i.test(tempCalle)) {
        tempCalle = `Calle ${tempCalle}`;
    }

    // Standardized full address: "Calle X 1234, Localidad"
    let full = tempCalle;
    if (numero) full += ` ${numero}`;
    if (loc && !full.toLowerCase().includes(loc.toLowerCase())) {
        full += `, ${loc}`;
    }

    return { calle: tempCalle, numero, full };
}
