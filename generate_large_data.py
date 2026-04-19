import json
import random

def generate_large_dataset():
    # Institution
    data = {
        "institution": {
            "name": "Mega Tech Institute of Technology",
            "periods_per_day": 8,
            "days_per_week": 5,
            "lunch_break_after_period": 4
        },
        "rooms": [],
        "teachers": [],
        "subjects": [],
        "classes": [] # Backend expects "classes", not "sections" in JSON
    }

    # Rooms (35 rooms to ensure enough capacity)
    # Types: classroom, lab, seminar_room
    for i in range(1, 21):
        data["rooms"].append({
            "id": f"R{i:03d}",
            "name": f"Classroom {100 + i}",
            "capacity": 80, # Set high to avoid "no room big enough" errors
            "type": "classroom"
        })
    for i in range(21, 31):
        data["rooms"].append({
            "id": f"R{i:03d}",
            "name": f"CS Lab {i-20}",
            "capacity": 70,
            "type": "lab"
        })
    for i in range(31, 36):
        data["rooms"].append({
            "id": f"R{i:03d}",
            "name": f"Seminar Room {i-30}",
            "capacity": 100,
            "type": "seminar_room"
        })

    # Subjects (20 subjects)
    theory_names = ["Mathematics", "Physics", "Data Structures", "Algorithms", "Operating Systems", "Networking", "AI", "Machine Learning", "Cloud Computing", "Software Engineering", "DBMS", "Digital Electronics", "Microprocessors", "Compiler Design"]
    lab_names = ["Programming Lab", "DS Lab", "Networking Lab", "Physics Lab", "DBMS Lab", "Workshop"]
    seminar_names = ["Employability Skills", "MOOCS Seminar"]

    for i, name in enumerate(theory_names):
        data["subjects"].append({
            "id": f"SUB{i+1:02d}",
            "name": name,
            "requires_room_type": "classroom",
            "min_lectures_per_week": 4,
            "is_lab": False
        })
    
    for i, name in enumerate(lab_names):
        data["subjects"].append({
            "id": f"LAB{i+1:02d}",
            "name": name,
            "requires_room_type": "lab",
            "min_lectures_per_week": 2,
            "is_lab": True
        })

    for i, name in enumerate(seminar_names):
        data["subjects"].append({
            "id": f"SEM{i+1:02d}",
            "name": name,
            "requires_room_type": "seminar_room",
            "min_lectures_per_week": 2,
            "is_lab": False
        })

    # Teachers (50 teachers)
    names = ["Dr. Sharma", "Prof. Verma", "Ms. Gupta", "Mr. Khan", "Dr. Reddy", "Prof. Das", "Ms. Iyer", "Mr. Joshi", "Dr. Patel", "Ms. Nair", "Mr. Singh", "Dr. Kapoor", "Prof. Malhotra", "Ms. Sethi", "Mr. Bajaj"]
    for i in range(1, 51):
        surname = random.choice(names)
        subj_expertise = random.sample([s["id"] for s in data["subjects"]], k=4)
        data["teachers"].append({
            "id": f"T{i:03d}",
            "name": f"{surname} {chr(65 + (i % 26))}",
            "max_lectures_per_week": 40,
            "teaches_subjects": subj_expertise
        })

    # Classes (24 sections)
    years = ["1", "2", "3", "4"]
    groups = ["A", "B", "C", "D", "E", "F"]
    
    for year in years:
        for group in groups:
            class_id = f"CS{year}{group}"
            curriculum = []
            
            # Select 5 theory subjects
            selected_theory = random.sample([s["id"] for s in data["subjects"] if s["requires_room_type"] == "classroom"], k=5)
            for s_id in selected_theory:
                potential_teachers = [t["id"] for t in data["teachers"] if s_id in t["teaches_subjects"]]
                t_id = random.choice(potential_teachers) if potential_teachers else f"T{random.randint(1, 50):03d}"
                curriculum.append({
                    "subject_id": s_id,
                    "teacher_id": t_id,
                    "min_per_week": 4
                })
            
            # Select 1 lab
            selected_lab = random.choice([s["id"] for s in data["subjects"] if s["requires_room_type"] == "lab"])
            potential_teachers = [t["id"] for t in data["teachers"] if selected_lab in t["teaches_subjects"]]
            t_id = random.choice(potential_teachers) if potential_teachers else f"T{random.randint(1, 50):03d}"
            curriculum.append({
                "subject_id": selected_lab,
                "teacher_id": t_id,
                "min_per_week": 2
            })

            # Select 1 seminar
            selected_sem = random.choice([s["id"] for s in data["subjects"] if s["requires_room_type"] == "seminar_room"])
            potential_teachers = [t["id"] for t in data["teachers"] if selected_sem in t["teaches_subjects"]]
            t_id = random.choice(potential_teachers) if potential_teachers else f"T{random.randint(1, 50):03d}"
            curriculum.append({
                "subject_id": selected_sem,
                "teacher_id": t_id,
                "min_per_week": 2
            })
            
            data["classes"].append({
                "id": class_id,
                "name": f"Year {year} - Section {group}",
                "student_count": 60,
                "curriculum": curriculum
            })

    with open('large_test_data.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print("Regenerated large_test_data.json with correct schema.")

if __name__ == "__main__":
    generate_large_dataset()
