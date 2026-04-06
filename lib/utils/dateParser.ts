/**
 * Utilidad robusta para parsear fechas de diversas fuentes (Excel, manual, ISO).
 * Maneja formatos: DD/MM/YYYY, D/M/YY, ISO, y seriales numéricos de Excel.
 */
export function parseExcelDate(value: any): Date | null {
    if (!value) return null;

    // 1. Si ya es una fecha válida
    if (value instanceof Date && !isNaN(value.getTime())) return value;

    let str = String(value).trim().toLowerCase();
    
    // 2. Manejo de serial numérico de Excel (ej: 45388)
    if (/^\d{5}$/.test(str)) {
        const serial = parseInt(str);
        // Excel base date is 1899-12-30
        return new Date((serial - 25569) * 86400 * 1000);
    }

    // 3. Manejo de formatos con nombres de meses en español (ej: "6-abr", "20-may")
    const meses: Record<string, number> = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };

    // Regex para "6-abr" o "6 abr"
    const monthMatch = str.match(/^(\d{1,2})[-\s/](\w{3})/);
    if (monthMatch) {
        const day = parseInt(monthMatch[1]);
        const monthShort = monthMatch[2];
        if (meses[monthShort] !== undefined) {
            const date = new Date();
            date.setMonth(meses[monthShort]);
            date.setDate(day);
            date.setHours(12, 0, 0, 0); // Al mediodía para evitar UTC shifts
            return date;
        }
    }

    // 4. Formatos DD/MM/YYYY o DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
    if (dmyMatch) {
        let day = parseInt(dmyMatch[1]);
        let month = parseInt(dmyMatch[2]) - 1;
        let year = parseInt(dmyMatch[3]);
        if (year < 100) year += 2000;
        const date = new Date(year, month, day, 12, 0, 0, 0);
        if (!isNaN(date.getTime())) return date;
    }

    // 5. Intento genérico de Date (ISO, etc)
    const generic = new Date(value);
    if (!isNaN(generic.getTime())) return generic;

    return null;
}

/**
 * Retorna un string YYYY-MM-DD seguro para la base de datos o inputs.
 */
export function formatAsISODate(value: any): string {
    const d = parseExcelDate(value);
    if (!d) return new Date().toISOString().split('T')[0];
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
