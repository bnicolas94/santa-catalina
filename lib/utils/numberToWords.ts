export function numberToWords(num: number): string {
    const units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const tens = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    if (num === 0) return 'cero';
    if (num === 100) return 'cien';

    let words = '';

    if (num >= 1000000) {
        const millions = Math.floor(num / 1000000);
        words += (millions === 1 ? 'un millón ' : numberToWords(millions) + ' millones ');
        num %= 1000000;
    }

    if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        words += (thousands === 1 ? 'mil ' : numberToWords(thousands) + ' mil ');
        num %= 1000;
    }

    if (num >= 100) {
        words += hundreds[Math.floor(num / 100)] + ' ';
        num %= 100;
    }

    if (num >= 20) {
        words += tens[Math.floor(num / 10)];
        if (num % 10 !== 0) words += ' y ' + units[num % 10];
    } else if (num >= 10) {
        words += teens[num - 10];
    } else if (num > 0) {
        words += units[num];
    }

    return words.trim().toLowerCase();
}

/**
 * Convierte un número a formato de moneda con palabras (pesos)
 */
export function formatCurrencyToWords(amount: number): string {
    const integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);
    
    let words = numberToWords(integerPart);
    
    if (decimalPart > 0) {
        return `${words} con ${decimalPart}/100`;
    }
    
    return words;
}
