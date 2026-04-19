import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\filled_timetable (1).xlsx"

if os.path.exists(file_path):
    try:
        excel_data = pd.read_excel(file_path, sheet_name=None, header=None)
        if 'Rooms' in excel_data:
            print("--- ROOMS SHEET ---")
            print(excel_data['Rooms'].head(10).to_string())
        if 'Subjects' in excel_data:
            print("--- SUBJECTS SHEET ---")
            print(excel_data['Subjects'].head(10).to_string())
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found")
