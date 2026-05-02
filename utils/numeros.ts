export function numeroALetras(num: number): string {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const decenas2 = ['', 'DIECI', 'VEINTI', 'TREINTA Y ', 'CUARENTA Y ', 'CINCUENTA Y ', 'SESENTA Y ', 'SETENTA Y ', 'OCHENTA Y ', 'NOVENTA Y '];

    if (num === 0) return 'CERO';
    if (num < 0) return 'MENOS ' + numeroALetras(Math.abs(num));

    let letras = '';

    if (num >= 1000000) {
        const millones = Math.floor(num / 1000000);
        letras += (millones === 1 ? 'UN MILLON ' : numeroALetras(millones) + ' MILLONES ');
        num %= 1000000;
    }

    if (num >= 1000) {
        const miles = Math.floor(num / 1000);
        letras += (miles === 1 ? 'MIL ' : numeroALetras(miles) + ' MIL ');
        num %= 1000;
    }

    if (num >= 100) {
        const centenas = Math.floor(num / 100);
        if (num === 100) letras += 'CIEN';
        else if (centenas === 1) letras += 'CIENTO ';
        else if (centenas === 5) letras += 'QUINIENTOS ';
        else if (centenas === 7) letras += 'SETECIENTOS ';
        else if (centenas === 9) letras += 'NOVECIENTOS ';
        else letras += unidades[centenas] + 'CIENTOS ';
        num %= 100;
    }

    if (num >= 20) {
        const dec = Math.floor(num / 10);
        const uni = num % 10;
        if (uni === 0) letras += decenas[dec];
        else letras += decenas2[dec] + unidades[uni];
    } else if (num >= 10) {
        letras += especiales[num - 10];
    } else if (num > 0) {
        letras += unidades[num];
    }

    return letras.trim();
}
