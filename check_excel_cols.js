
const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'docs', '11111.xlsx');
const workbook = xlsx.readFile(filePath);

workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json(sheet, { header: "A", range: 0, defval: "" });
    console.log(`Sheet: ${name}, Rows: ${data.length}`);
    if (data.length > 0) {
        // Encontrar la primera fila que parezca tener datos (Fecha en A, Nombre en B, Pedido en C)
        // La fecha en Excel suele ser un número o algo que empieza con día/mes
        const sample = data.find(r => r["A"] && r["B"] && r["C"] && r["B"] !== "Nombre y Apellido");
        if (sample) {
            console.log(`Sample from ${name}:`, JSON.stringify(sample, null, 2));
        }
    }
});
