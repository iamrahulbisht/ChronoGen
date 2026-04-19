import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\filled_timetable (1).xlsx"

if os.path.exists(file_path):
    try:
        excel_data = pd.read_excel(file_path, sheet_name=None, header=None)
        if 'Teachers' in excel_data:
            print("--- ALL TEACHERS ---")
            print(excel_data['Teachers'].to_string())
        if 'Curriculum' in excel_data:
            print("--- CURRICULUM TEACHERS ---")
            print(excel_data['Curriculum'].iloc[:, 2].unique().tolist())
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found")
