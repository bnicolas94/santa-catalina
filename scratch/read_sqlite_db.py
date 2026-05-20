import sqlite3
import json
import os

db_path = os.path.join(os.path.dirname(__file__), '../prisma/dev.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get list of tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]
print("Tables:", tables)

# Query ficha_tecnica
try:
    cursor.execute("SELECT * FROM ficha_tecnica")
    columns = [col[0] for col in cursor.description]
    fichas = [dict(zip(columns, row)) for row in cursor.fetchall()]
    print("\n=== SQLITE FICHA_TECNICA ===")
    print(json.dumps(fichas, indent=2))
except Exception as e:
    print("Error querying ficha_tecnica:", e)

# Query insumos
try:
    cursor.execute("SELECT * FROM insumos")
    columns = [col[0] for col in cursor.description]
    insumos = [dict(zip(columns, row)) for row in cursor.fetchall()]
    print("\n=== SQLITE INSUMOS ===")
    print(json.dumps(insumos[:10], indent=2)) # top 10
except Exception as e:
    print("Error querying insumos:", e)

conn.close()
