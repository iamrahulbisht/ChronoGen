import pandas as pd
import os

file_path = r"c:\Users\Yash\Desktop\final-round-return-0\data\filled_timetable (1).xlsx"

if os.path.exists(file_path):
    try:
        excel_data = pd.read_excel(file_path, sheet_name=None, header=None)
        if 'Curriculum' in excel_data:
            df = excel_data['Curriculum']
            print("--- TEACHERS IN CURRICULUM ---")
            print(df.iloc[:, 2].unique().tolist())
            
            # Search for AA, PK, KU specifically
            for teacher in ['AA', 'PK', 'KU']:
                found = df[df.iloc[:, 2].astype(str).str.contains(teacher, na=False)]
                if not found.empty:
                    print(f"\nFOUND {teacher} in Curriculum:")
                    print(found.to_string())
        else:
            print("Curriculum sheet not found")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found")
