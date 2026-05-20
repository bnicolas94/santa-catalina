const { DatabaseSync } = require('node:sqlite');

try {
    const db = new DatabaseSync('prisma/dev.db');
    
    const ftQuery = db.prepare(`SELECT * FROM fichas_tecnicas`);
    const rows = ftQuery.all();
    
    const prodQuery = db.prepare(`SELECT id, nombre FROM productos`);
    const products = prodQuery.all();
    
    const insQuery = db.prepare(`SELECT id, nombre FROM insumos`);
    const insumos = insQuery.all();
    
    console.log("=== FORMATED FICHAS ===");
    for (const r of rows) {
        const prod = products.find(p => p.id === r.id_producto);
        const ins = insumos.find(i => i.id === r.id_insumo);
        console.log(`Product: ${prod?.nombre} (${r.id_producto}) -> Insumo: ${ins?.nombre} (${r.id_insumo}) -> Cantidad: ${r.cantidad_por_unidad}`);
    }
} catch (error) {
    console.error("Error:", error);
}
