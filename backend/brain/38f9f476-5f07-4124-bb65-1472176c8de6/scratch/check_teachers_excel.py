import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\filled_timetable (1).xlsx"

if os.path.exists(file_path):
    try:
        excel_data = pd.read_excel(file_path, sheet_name=None, header=None)
        if 'Teachers' in excel_data:
            print("--- TEACHERS SHEET ---")
            print(excel_data['Teachers'].head(10).to_string())
        else:
            # Maybe it's in the first sheet?
            print("--- FIRST SHEET (TOP 100) ---")
            print(list(excel_data.values())[0].head(100).to_string())
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found")
