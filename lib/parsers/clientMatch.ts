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
 * Intenta encontrar o sugerir un cliente desde la DB en base a los datos del Excel
 * @param nombreExcel - Nombre tal como viene del Excel (ej: "#487 Marita")
 * @param telefonoExcel - Teléfono tal como viene del Excel
 * @param clientesDB - Todos los clientes del sistema para comparación
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

    // 1. Prioridad: Coincidencia por teléfono (es un identificador muy fuerte)
    if (normPhoneExcel.length > 5) { // al menos un numero valido
        const matchByPhone = clientesDB.find((c) => {
            const dbPhone = normalizePhone(c.contactoTelefono);
            return dbPhone && dbPhone === normPhoneExcel;
        });

        if (matchByPhone) {
            return {
                clienteId: matchByPhone.id,
                isNew: false,
                confidence: "high", // Match exacto por teléfono = alta confianza
                proposedData: {
                    nombreComercial: nombreExcel,
                    contactoTelefono: telefonoExcel || undefined,
                    direccion: parseDireccion(direccionExcel, localidadExcel).full || undefined,
                    localidad: localidadExcel || undefined,
                },
            };
        }
    }

    // 2. Coincidencia por Nombre exacto (normalizado)
    const matchByName = clientesDB.find(
        (c) => normalizeString(c.nombreComercial) === normNameExcel
    );

    if (matchByName) {
        // Si el Excel trae un telefono nuevo pero el nombre coincide exacto
        // Lo asociamos, pero con confianza media para que un humano lo apruebe visualmente
        return {
            clienteId: matchByName.id,
            isNew: false,
            confidence: normPhoneExcel && !matchByName.contactoTelefono ? "medium" : "high",
            proposedData: {
                nombreComercial: nombreExcel,
                contactoTelefono: telefonoExcel || undefined,
                direccion: parseDireccion(direccionExcel, localidadExcel).full || undefined,
                localidad: localidadExcel || undefined,
            },
        };
    }

    // 3. Fallback: Cliente Nuevo
    return {
        isNew: true,
        confidence: "low", // Como es nuevo a partir del excel, sugerimos revisión
        proposedData: {
            nombreComercial: nombreExcel.trim(),
            contactoTelefono: telefonoExcel ? telefonoExcel.trim() : undefined,
            direccion: direccionExcel ? parseDireccion(direccionExcel, localidadExcel).full || undefined : undefined,
            localidad: localidadExcel ? localidadExcel.trim() : undefined,
        },
    };
}
