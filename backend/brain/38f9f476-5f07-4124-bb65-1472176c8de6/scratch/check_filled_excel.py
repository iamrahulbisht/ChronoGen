import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\filled_timetable (1).xlsx"

if os.path.exists(file_path):
    try:
        df = pd.read_excel(file_path, sheet_name=0, header=None)
        print("--- FULL EXCEL CONTENT ---")
        print(df.to_string())
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found")
