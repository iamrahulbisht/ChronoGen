import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\ChronoGen_Input_Template (1).xlsx"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
else:
    try:
        excel_data = pd.read_excel(file_path, sheet_name=None)
        print(f"Sheets found: {list(excel_data.keys())}")
        for sheet, df in excel_data.items():
            print(f"\nSheet: {sheet}")
            print(f"Columns: {df.columns.tolist()}")
            print(f"Sample data (first 2 rows):\n{df.head(2)}")
    except Exception as e:
        print(f"Error reading Excel: {e}")
