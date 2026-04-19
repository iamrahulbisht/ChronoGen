import pandas as pd
import numpy as np

file_path = r'c:\Users\Yash\Desktop\final-round-return-0\data\huge_filled_template.xlsx'
df = pd.read_excel(file_path, sheet_name=0, header=None)

# Find markers
markers = {}
for i, row in df.iterrows():
    val = str(row.iloc[0]).strip().upper()
    if val.startswith('[') and val.endswith(']'):
        markers[val] = i

print(f"Markers found: {list(markers.keys())}")

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

rooms = get_section('[ROOMS]')
subjects = get_section('[SUBJECTS]')
teachers = get_section('[TEACHERS]')
classes = get_section('[CLASSES]')
curriculum = get_section('[CURRICULUM]')

print(f"\nRooms: {len(rooms) if rooms is not None else 0}")
print(f"Subjects: {len(subjects) if subjects is not None else 0}")
print(f"Teachers: {len(teachers) if teachers is not None else 0}")
print(f"Classes: {len(classes) if classes is not None else 0}")
print(f"Curriculum entries: {len(curriculum) if curriculum is not None else 0}")

# Check for obvious mismatches
if teachers is not None and curriculum is not None:
    # Use 'Teacher ID' column in curriculum based on headers seen
    t_id_col = 'Teacher ID' if 'Teacher ID' in curriculum.columns else 'Teacher ID/Name'
    
    t_codes = set(teachers['ID'].dropna().astype(str).str.strip())
    t_names = set(teachers['Name'].dropna().astype(str).str.strip())
    
    print(f"\nChecking Curriculum vs Teachers (using column '{t_id_col}')...")
    curr_teachers = curriculum[t_id_col].unique()
    missing = []
    for t in curr_teachers:
        if pd.isna(t): continue
        t_str = str(t).strip()
        if t_str not in t_codes and t_str not in t_names:
            missing.append(t_str)
    
    if missing:
        print(f"Missing Teachers in Curriculum: {missing[:10]}... (Total: {len(missing)})")
    else:
        print("All teachers in curriculum exist in Teachers sheet.")

if subjects is not None and curriculum is not None:
    s_id_col = 'Subject ID' if 'Subject ID' in curriculum.columns else 'Subject ID/Name'
    
    s_codes = set(subjects['ID'].dropna().astype(str).str.strip())
    s_names = set(subjects['Name'].dropna().astype(str).str.strip())
    
    print(f"\nChecking Curriculum vs Subjects (using column '{s_id_col}')...")
    curr_subjects = curriculum[s_id_col].unique()
    missing_s = []
    for s in curr_subjects:
        if pd.isna(s): continue
        s_str = str(s).strip()
        if s_str not in s_codes and s_str not in s_names:
            missing_s.append(s_str)
            
    if missing_s:
        print(f"Missing Subjects in Curriculum: {missing_s[:10]}... (Total: {len(missing_s)})")
    else:
        print("All subjects in curriculum exist in Subjects sheet.")

# Check for teacher qualification
if teachers is not None and curriculum is not None:
    print("\nChecking Teacher Qualifications...")
    teacher_subj_map = {}
    for _, row in teachers.iterrows():
        tid = str(row['ID']).strip()
        tname = str(row['Name']).strip()
        subjs_str = str(row.get('Teaches Subjects (IDs comma separated)', ''))
        subjs = [s.strip() for s in subjs_str.split(',') if s.strip()]
        teacher_subj_map[tid] = set(subjs)
        teacher_subj_map[tname] = set(subjs)
        
    qual_errors = []
    for i, row in curriculum.iterrows():
        tid = str(row[t_id_col]).strip()
        sid = str(row[s_id_col]).strip()
        if tid in teacher_subj_map:
            if sid not in teacher_subj_map[tid]:
                # Try name lookup for sid
                s_code_from_name = ""
                if sid in s_names:
                    # find code
                    match = subjects[subjects['Name'] == sid]
                    if not match.empty:
                        s_code_from_name = str(match.iloc[0]['ID']).strip()
                
                if sid not in teacher_subj_map[tid] and s_code_from_name not in teacher_subj_map[tid]:
                    qual_errors.append(f"Teacher '{tid}' cannot teach subject '{sid}' (Row {i+markers['[CURRICULUM]']+3})")
    
    if qual_errors:
        print(f"Qualification Errors found: {len(qual_errors)}")
        for err in qual_errors[:15]:
            print(f" - {err}")
    else:
        print("No qualification errors found.")
