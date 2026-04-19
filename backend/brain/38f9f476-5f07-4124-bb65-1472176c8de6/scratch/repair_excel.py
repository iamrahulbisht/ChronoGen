import pandas as pd
import numpy as np
from collections import defaultdict

file_path = r'c:\Users\Yash\Desktop\final-round-return-0\data\huge_filled_template.xlsx'
df = pd.read_excel(file_path, sheet_name=0, header=None)

# Find markers
markers = {}
for i, row in df.iterrows():
    val = str(row.iloc[0]).strip().upper()
    if val.startswith('[') and val.endswith(']'):
        markers[val] = i

def get_section(marker):
    if marker not in markers: return None
    start = markers[marker]
    header = [str(h).strip() for h in df.iloc[start+1].tolist()]
    data = []
    for i in range(start+2, len(df)):
        row = df.iloc[i].tolist()
        if pd.isna(row[0]) or str(row[0]).startswith('['): break
        data.append(row)
    return pd.DataFrame(data, columns=header)

teachers = get_section('[TEACHERS]')
curriculum = get_section('[CURRICULUM]')
subjects = get_section('[SUBJECTS]')

if teachers is not None and curriculum is not None:
    # 1. Collect required qualifications from curriculum
    teacher_needs = defaultdict(set)
    teacher_workload = defaultdict(int)
    
    t_id_col = 'Teacher ID' if 'Teacher ID' in curriculum.columns else 'Teacher ID/Name'
    s_id_col = 'Subject ID' if 'Subject ID' in curriculum.columns else 'Subject ID/Name'
    
    for _, row in curriculum.iterrows():
        tid = str(row[t_id_col]).strip()
        sid = str(row[s_id_col]).strip()
        count = int(row['Min Per Week'])
        teacher_needs[tid].add(sid)
        teacher_workload[tid] += count

    print(f"Repairing {len(teacher_needs)} teachers...")

    # 2. Update Teachers DataFrame
    # Note: 'Teaches Subjects (IDs comma separated)'
    # We need to map Name back to ID if curriculum uses names
    t_name_to_id = {str(row['Name']).strip(): str(row['ID']).strip() for _, row in teachers.iterrows()}
    
    for i, row in teachers.iterrows():
        tid = str(row['ID']).strip()
        tname = str(row['Name']).strip()
        
        # Get all sid needs for this teacher (either by ID or Name)
        needed_sids = teacher_needs.get(tid, set()) | teacher_needs.get(tname, set())
        
        if needed_sids:
            # Current subjects
            current_str = str(row.get('Teaches Subjects (IDs comma separated)', ''))
            current_sids = set([s.strip() for s in current_str.split(',') if s.strip()])
            
            # Combine
            new_sids = current_sids | needed_sids
            teachers.at[i, 'Teaches Subjects (IDs comma separated)'] = ", ".join(sorted(list(new_sids)))
            
            # Fix Workload
            total_workload = teacher_workload.get(tid, 0) + teacher_workload.get(tname, 0)
            current_max = int(row['Max Lectures/Week'])
            if total_workload > current_max:
                teachers.at[i, 'Max Lectures/Week'] = total_workload + 2 # Give some buffer
                print(f"Updated Max/Week for {tname}: {current_max} -> {total_workload + 2}")

    # 3. Write back to Excel
    # We need to preserve the layout. I'll just overwrite the rows in the original 'df'
    t_start = markers['[TEACHERS]'] + 2
    for i, (_, row) in enumerate(teachers.iterrows()):
        for j, val in enumerate(row):
            df.iloc[t_start + i, j] = val

    save_path = r'c:\Users\Yash\Desktop\final-round-return-0\data\huge_filled_template_fixed.xlsx'
    df.to_excel(save_path, index=False, header=False)
    print(f"\nFixed file saved to: {save_path}")
