import sqlite3
import json

def main():
    conn = sqlite3.connect('prisma/dev.db')
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in cursor.fetchall()]
    print("Tables:", tables)
    
    # Let's count rows in each table
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"{table}: {count}")
        except Exception as e:
            print(f"Error counting {table}: {e}")
            
    # Let's print FichaTecnica if it exists and has rows
    if 'FichaTecnica' in tables or 'ficha_tecnicas' in tables:
        table_name = 'FichaTecnica' if 'FichaTecnica' in tables else 'ficha_tecnicas'
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        print(f"\nRows in {table_name}:", len(rows))
        for row in rows[:10]:
            print(row)
            
    conn.close()

if __name__ == '__main__':
    main()
