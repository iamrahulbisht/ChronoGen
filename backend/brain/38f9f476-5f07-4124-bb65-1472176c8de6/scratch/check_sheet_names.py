import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\filled_timetable (1).xlsx"

if os.path.exists(file_path):
    try:
        excel_data = pd.read_excel(file_path, sheet_name=None, header=None)
        print("--- EXACT SHEET NAMES ---")
        for s_name in excel_data.keys():
            print(f"'{s_name}'")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found")
