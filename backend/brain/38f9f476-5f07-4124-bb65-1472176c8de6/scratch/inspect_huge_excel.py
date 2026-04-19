import pandas as pd
import os

file_path = r'c:\Users\Yash\Desktop\final-round-return-0\data\huge_filled_template.xlsx'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
else:
    xls = pd.ExcelFile(file_path)
    print(f"Sheets: {xls.sheet_names}")
    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet)
        print(f"\n--- Sheet: {sheet} ---")
        print(df.head(10))
        print(f"Shape: {df.shape}")
