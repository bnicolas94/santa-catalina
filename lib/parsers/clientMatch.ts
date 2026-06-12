import { parseDireccion } from "./addressUtils";

export type ClienteData = {
    id: string;
    nombreComercial: string;
    contactoTelefono: string | null;
};

export type ClientMatchResult = {
    clienteId?: string;
    isNew: boolean;
    confidence: "high" | "medium" | "low";
    proposedData: {
        nombreComercial: string;
        contactoTelefono?: string;
        direccion?: string;
        localidad?: string;
    };
};

/**
 * Normaliza un string removiendo espacios extra, tildes y pasando a minúsculas
 */
function normalizeString(str: string): string {
    if (!str) return "";
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove tildes
        .trim()
        .toLowerCase();
}

/**
 * Normaliza un número de teléfono dejando solo dígitos
 */
function normalizePhone(phone: string | null): string {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
}

/**
 * Intenta encontrar o sugerir un cliente desde la DB en base a los datos del Excel.
 * 
 * PRIORIDAD DE CRUCE:
 * 1° TELÉFONO — Es el identificador único por excelencia.
 *    Si el teléfono del Excel coincide con uno en la DB, es el mismo cliente
 *    sin importar que el nombre haya cambiado. El nombre se actualiza.
 * 2° NOMBRE EXACTO — Solo si no hay teléfono o no coincide.
 * 3° CLIENTE NUEVO — Si no matchea por ningún criterio.
 */
export function matchClient(
    nombreExcel: string,
    telefonoExcel: string | null,
    direccionExcel: string | null,
    localidadExcel: string | null,
    clientesDB: ClienteData[]
): ClientMatchResult {
    const normNameExcel = normalizeString(nombreExcel);
    const normPhoneExcel = normalizePhone(telefonoExcel);

    if (!normNameExcel && !normPhoneExcel) {
        return {
            isNew: true,
            confidence: "low",
            proposedData: { 
                nombreComercial: "CLIENTE DESCONOCIDO",
                direccion: parseDireccion(direccionExcel, localidadExcel).full || undefined,
                localidad: localidadExcel || undefined,
            },
        };
    }

    // 1. PRIORIDAD MÁXIMA: Coincidencia por teléfono (identificador único del cliente)
    if (normPhoneExcel.length > 5) {
        const matchByPhone = clientesDB.find((c) => {
            const dbPhone = normalizePhone(c.contactoTelefono);
            return dbPhone && dbPhone === normPhoneExcel;
        });

        if (matchByPhone) {
            // El teléfono es el mismo → es el mismo cliente.
            // El nombre del Excel se toma como el más actualizado (proposedData).
            return {
                clienteId: matchByPhone.id,
                isNew: false,
                confidence: "high",
                proposedData: {
                    nombreComercial: nombreExcel.trim(),
                    contactoTelefono: telefonoExcel || undefined,
                    direccion: parseDireccion(direccionExcel, localidadExcel).full || undefined,
                    localidad: localidadExcel || undefined,
                },
            };
        }
    }

    // 2. Coincidencia por Nombre exacto (normalizado) — solo si no matcheó por teléfono
    const matchByName = clientesDB.find(
        (c) => normalizeString(c.nombreComercial) === normNameExcel
    );

    if (matchByName) {
        return {
            clienteId: matchByName.id,
            isNew: false,
            confidence: normPhoneExcel && !matchByName.contactoTelefono ? "medium" : "high",
            proposedData: {
                nombreComercial: nombreExcel.trim(),
                contactoTelefono: telefonoExcel || undefined,
                direccion: parseDireccion(direccionExcel, localidadExcel).full || undefined,
                localidad: localidadExcel || undefined,
            },
        };
    }

    // 3. Fallback: Cliente Nuevo
    return {
        isNew: true,
        confidence: "low",
        proposedData: {
            nombreComercial: nombreExcel.trim(),
            contactoTelefono: telefonoExcel ? telefonoExcel.trim() : undefined,
            direccion: direccionExcel ? parseDireccion(direccionExcel, localidadExcel).full || undefined : undefined,
            localidad: localidadExcel ? localidadExcel.trim() : undefined,
        },
    };
}
