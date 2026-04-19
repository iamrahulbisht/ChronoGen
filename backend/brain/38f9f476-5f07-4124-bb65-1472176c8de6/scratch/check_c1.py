import pandas as pd

file_path = r'c:\Users\Yash\Desktop\final-round-return-0\data\huge_filled_template.xlsx'
df = pd.read_excel(file_path, sheet_name=0, header=None)

# Find markers
markers = {}
for i, row in df.iterrows():
    val = str(row.iloc[0]).strip().upper()
    if val.startswith('[') and val.endswith(']'):
        markers[val] = i

# Find C1 in Curriculum
c_start = markers['[CURRICULUM]'] + 2
found = []
for i in range(c_start, len(df)):
    row = df.iloc[i].tolist()
    if str(row[0]).strip() == 'C1':
        found.append(row)
    if pd.isna(row[0]) or str(row[0]).startswith('['): break

print(f"C1 Curriculum rows: {found}")
