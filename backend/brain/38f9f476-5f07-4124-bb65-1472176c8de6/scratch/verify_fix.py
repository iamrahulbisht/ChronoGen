import pandas as pd

file_path = r'c:\Users\Yash\Desktop\final-round-return-0\data\huge_filled_template.xlsx'
df = pd.read_excel(file_path, sheet_name=0, header=None)

# Find Teacher 91
found = False
for i, row in df.iterrows():
    if str(row.iloc[0]).strip() == 'T91':
        print(f"Row {i} found: {row.tolist()}")
        found = True
        break

if not found:
    print("Teacher 91 not found in the file!")
