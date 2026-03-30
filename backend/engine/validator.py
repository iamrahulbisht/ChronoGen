from backend.engine.models import Config


def validate(config: Config) -> bool:
    errors = []
    warnings = []

    inst = config.institution
    total_slots = inst.days_per_week * inst.periods_per_day

    # Check 1: Total lectures per class must not exceed available slots
    for cls in config.classes:
        total_needed = sum(e.min_per_week for e in cls.curriculum)
        if total_needed > total_slots:
            errors.append(
                f"[E] Class '{cls.id}': needs {total_needed} lectures "
                f"but only {total_slots} slots available per week."
            )

    # Check 2: Every teacher_id in curriculum must exist and teach that subject
    for cls in config.classes:
        for entry in cls.curriculum:
            if entry.teacher_id not in config.teachers:
                errors.append(
                    f"[E] Class '{cls.id}': teacher '{entry.teacher_id}' not found."
                )
            else:
                teacher = config.teachers[entry.teacher_id]
                if entry.subject_id not in teacher.teaches_subjects:
                    errors.append(
                        f"[E] Class '{cls.id}': teacher '{teacher.name}' "
                        f"cannot teach '{entry.subject_id}'."
                    )

    # Check 3: Teacher workload must be feasible
    # Calculate how many lectures each teacher is required to give (across all classes)
    teacher_required = {}
    for cls in config.classes:
        for entry in cls.curriculum:
            tid = entry.teacher_id
            teacher_required[tid] = teacher_required.get(tid, 0) + entry.min_per_week

    for tid, required in teacher_required.items():
        teacher = config.teachers[tid]
        if required > teacher.max_lectures_per_week:
            errors.append(
                f"[E] Teacher '{teacher.name}': required {required} lectures/week "
                f"but max is {teacher.max_lectures_per_week}. Schedule is infeasible."
            )

    # Check 4: At least one room of required type must exist for every subject
    room_types_available = set(r.type for r in config.rooms.values())
    for subj in config.subjects.values():
        if subj.requires_room_type not in room_types_available:
            errors.append(
                f"[E] Subject '{subj.name}' requires room type "
                f"'{subj.requires_room_type}' but none exists."
            )

    # Check 5: Room capacity warnings
    for cls in config.classes:
        for entry in cls.curriculum:
            subj = config.subjects.get(entry.subject_id)
            if not subj:
                continue
            suitable = [
                r
                for r in config.rooms.values()
                if r.type == subj.requires_room_type and r.capacity >= cls.student_count
            ]
            if not suitable:
                errors.append(
                    f"[E] Class '{cls.id}' ({cls.student_count} students) has no "
                    f"room big enough for subject '{entry.subject_id}' "
                    f"(needs type '{subj.requires_room_type}')."
                )

    # Print results
    if errors:
        print("\nVALIDATION FAILED")
        for e in errors:
            print(" ", e)
        print()
        return False

    if warnings:
        print("\nWARNINGS")
        for w in warnings:
            print(" ", w)

    print(
        f"Validation passed. "
        f"{len(config.classes)} classes, "
        f"{len(config.teachers)} teachers, "
        f"{len(config.rooms)} rooms, "
        f"{total_slots} slots/week."
    )
    return True