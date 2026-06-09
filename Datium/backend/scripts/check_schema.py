import sqlite3
import os

db_path = os.path.join('c:\\Users\\Nico9\\OneDrive\\Escritorio\\Datium-py\\Datium', 'db.sqlite3')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(chatbot_chatmessage)")
columns = cursor.fetchall()
with open('c:\\Users\\Nico9\\OneDrive\\Escritorio\\Datium-py\\Datium\\schema_output.txt', 'w') as f:
    for col in columns:
        f.write(str(col) + '\n')
conn.close()
