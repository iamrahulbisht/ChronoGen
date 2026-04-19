import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\ChronoGen_Input_Template (1).xlsx"

if os.path.exists(file_path):
    df = pd.read_excel(file_path, sheet_name='Timetable Input')
    print(df.to_string())
