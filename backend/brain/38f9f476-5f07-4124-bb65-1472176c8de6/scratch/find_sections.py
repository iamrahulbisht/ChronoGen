import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\ChronoGen_Input_Template (1).xlsx"

if os.path.exists(file_path):
    df = pd.read_excel(file_path, sheet_name=0, header=None)
    # Print rows to see where sections start
    for i, row in df.iterrows():
        val = str(row[0]).strip()
        if val in ['INSTITUTION', 'ROOMS', 'SUBJECTS', 'TEACHERS', 'CLASSES & CURRICULUM']:
            print(f"FOUND SECTION {val} at Row {i}")
