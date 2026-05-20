const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to the SQLite database.');
});

db.all("SELECT * FROM ficha_tecnica", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('=== SQLITE FICHA_TECNICA ===');
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
