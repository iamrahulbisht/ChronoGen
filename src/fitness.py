from collections import defaultdict

from src.models import Config

MAX_SCORE = 200000


def evaluate_fitness(chromosome, config: Config) -> int:

    teacher_slot_genes = defaultdict(list)
    room_slot_genes = defaultdict(list)
    class_slot_genes = defaultdict(list)

    class_day_subjects = defaultdict(lambda: defaultdict(list))
    teacher_count = defaultdict(int)
    class_subj_count = defaultdict(lambda: defaultdict(int))
    teacher_day_periods = defaultdict(lambda: defaultdict(list))
    class_day_periods = defaultdict(lambda: defaultdict(list))

    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        is_lab = subj.is_lab if subj else False
        weight = 2 if is_lab else 1
        
        teacher_count[gene.teacher_id] += weight
        class_subj_count[gene.class_id][gene.subject_id] += 1
        
        for p_offset in range(weight):
            curr_p = gene.period + p_offset
            if curr_p <= config.institution.periods_per_day:
                teacher_slot_genes[(gene.teacher_id, gene.day, curr_p)].append(gene)
                class_slot_genes[(gene.class_id, gene.day, curr_p)].append(gene)
                room_slot_genes[(gene.room_id, gene.day, curr_p)].append(gene)
                
                teacher_day_periods[gene.teacher_id][gene.day].append(curr_p)
                class_day_periods[gene.class_id][gene.day].append(curr_p)
        
        class_day_subjects[gene.class_id][gene.day].append(gene.subject_id)

    penalty = 0

    # HARD CONSTRAINTS 

    # H1: Teacher in two places at same time
    for (tid, day, period), genes in teacher_slot_genes.items():
        if len(genes) > 1:
            penalty += (len(genes) - 1) * 1000

    # H2 + H4: Class double-booked in same slot (also covers two subjects same period)
    for (cid, day, period), genes in class_slot_genes.items():
        if len(genes) > 1:
            penalty += (len(genes) - 1) * 1000

    # H3: Room used by two classes at same time
    for (rid, day, period), genes in room_slot_genes.items():
        if len(genes) > 1:
            penalty += (len(genes) - 1) * 1000

    # SOFT CONSTRAINTS 

    # S1: Each subject must appear min_per_week times for each class (weight 10)
    for cls in config.classes:
        for entry in cls.curriculum:
            actual = class_subj_count[cls.id][entry.subject_id]
            missing = max(0, entry.min_per_week - actual)
            penalty += missing * 10

    # S2: Teacher must not exceed max_lectures_per_week (weight 5)
    for tid, teacher in config.teachers.items():
        excess = max(0, teacher_count[tid] - teacher.max_lectures_per_week)
        penalty += excess * 5

    # S3: Teacher max consecutive lectures (weight 3)
    for tid, day_map in teacher_day_periods.items():
        teacher = config.teachers.get(tid)
        if not teacher:
            continue
        max_consec = teacher.max_consecutive_lectures
        for day, periods in day_map.items():
            sorted_periods = sorted(set(periods))
            # find longest consecutive run
            run = 1
            for i in range(1, len(sorted_periods)):
                if sorted_periods[i] == sorted_periods[i - 1] + 1:
                    run += 1
                    if run > max_consec:
                        penalty += 3
                else:
                    run = 1

    # S4: Same subject twice in one day for a class (weight 2)
    for cid, day_map in class_day_subjects.items():
        for day, subj_list in day_map.items():
            seen = set()
            for s in subj_list:
                if s in seen:
                    penalty += 2
                seen.add(s)

    # S8: Morning-preference teacher assigned afternoon slot (weight 2)
    # Afternoon = period > periods_per_day // 2
    half = config.institution.periods_per_day // 2
    for gene in chromosome:
        teacher = config.teachers.get(gene.teacher_id)
        if teacher and teacher.prefers_morning and gene.period > half:
            penalty += 2

    # S9: Prefer lectures in first 4 periods of the day (soft priority)
    # Period 5-8 gets a small penalty. Period 5 = 1pt, 6 = 2pt, 7 = 3pt, 8 = 4pt.
    EARLY_PERIOD_CUTOFF = 4
    for gene in chromosome:
        if gene.period > EARLY_PERIOD_CUTOFF:
            penalty += (gene.period - EARLY_PERIOD_CUTOFF) * 1

    # S5: Free periods (gaps) in a class's day should be minimised (weight 1)
    for cid, day_map in class_day_periods.items():
        for day, periods in day_map.items():
            if not periods:
                continue
            sorted_p = sorted(set(periods))
            gaps = (sorted_p[-1] - sorted_p[0] + 1) - len(sorted_p)
            if gaps > 0:
                penalty += gaps * 1

    # S6: A teacher's free periods between assigned lectures should be minimised (weight 1)
    for tid, day_map in teacher_day_periods.items():
        for day, periods in day_map.items():
            if not periods:
                continue
            sorted_p = sorted(set(periods))
            gaps = (sorted_p[-1] - sorted_p[0] + 1) - len(sorted_p)
            if gaps > 0:
                penalty += gaps * 1

    # S10: Minimize distinct classrooms per section (weight 3)
    # Each section should ideally use only 1 classroom for theory.
    # Every extra distinct classroom beyond 1 adds penalty.
    class_theory_rooms = defaultdict(set)
    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        if subj and not subj.is_lab:
            class_theory_rooms[gene.class_id].add(gene.room_id)
    for cid, rooms_used in class_theory_rooms.items():
        extra = len(rooms_used) - 1  # 1 classroom is free, each extra penalized
        if extra > 0:
            penalty += extra * 3

    # LAB CONSTRAINTS 
    class_occupied_by_theory = set()
    teacher_occupied_by_theory = set()
    room_occupied_by_theory = set()
    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        if subj and not subj.is_lab:
            class_occupied_by_theory.add((gene.class_id, gene.day, gene.period))
            teacher_occupied_by_theory.add((gene.teacher_id, gene.day, gene.period))
            room_occupied_by_theory.add((gene.room_id, gene.day, gene.period))

    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        if subj and subj.is_lab:

            # H_LAB1: period must be odd
            if gene.period % 2 == 0:
                penalty += 500

            # H_LAB2: next period must be free from theory
            next_period = gene.period + 1
            if next_period <= config.institution.periods_per_day:
                if (gene.class_id, gene.day, next_period) in class_occupied_by_theory:
                    penalty += 500
                elif (gene.teacher_id, gene.day, next_period) in teacher_occupied_by_theory:
                    penalty += 500
                elif (gene.room_id, gene.day, next_period) in room_occupied_by_theory:
                    penalty += 500
                # Only penalize if OTHER genes occupy the next slot
                c_genes = class_slot_genes.get((gene.class_id, gene.day, next_period), [])
                t_genes = teacher_slot_genes.get((gene.teacher_id, gene.day, next_period), [])
                r_genes = room_slot_genes.get((gene.room_id, gene.day, next_period), [])
                
                if any(g.period != gene.period for g in c_genes):
                     penalty += 500
                elif any(g.period != gene.period for g in t_genes):
                     penalty += 500
                elif any(g.period != gene.period for g in r_genes):
                     penalty += 500

    return max(0, MAX_SCORE - penalty)


def get_penalty_breakdown(chromosome, config: Config) -> dict:
    teacher_slot_genes = defaultdict(list)
    room_slot_genes = defaultdict(list)
    class_slot_genes = defaultdict(list)
    class_day_subjects = defaultdict(lambda: defaultdict(list))
    teacher_count = defaultdict(int)
    class_subj_count = defaultdict(lambda: defaultdict(int))
    teacher_day_periods = defaultdict(lambda: defaultdict(list))
    class_day_periods = defaultdict(lambda: defaultdict(list))

    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        is_lab = subj.is_lab if subj else False
        weight = 2 if is_lab else 1
        
        teacher_count[gene.teacher_id] += weight
        class_subj_count[gene.class_id][gene.subject_id] += 1
        
        for p_offset in range(weight):
            curr_p = gene.period + p_offset
            if curr_p <= config.institution.periods_per_day:
                teacher_slot_genes[(gene.teacher_id, gene.day, curr_p)].append(gene)
                class_slot_genes[(gene.class_id, gene.day, curr_p)].append(gene)
                room_slot_genes[(gene.room_id, gene.day, curr_p)].append(gene)
                
                teacher_day_periods[gene.teacher_id][gene.day].append(curr_p)
                class_day_periods[gene.class_id][gene.day].append(curr_p)
        
        class_day_subjects[gene.class_id][gene.day].append(gene.subject_id)

    breakdown = {
        "hard_penalties": {
            "H1_teacher_clash": 0,
            "H2_class_clash": 0,
            "H3_room_clash": 0,
            "H_LAB1_odd_period": 0,
            "H_LAB2_next_free": 0,
        },
        "soft_penalties": {
            "S1_missing_lectures": 0,
            "S2_teacher_overload": 0,
            "S3_consecutive": 0,
            "S4_same_subj_day": 0,
            "S5_class_gaps": 0,
            "S6_teacher_gaps": 0,
            "S8_morning_pref": 0,
            "S9_late_period": 0,
            "S10_room_spread": 0,
        }
    }

    for (tid, day, period), genes in teacher_slot_genes.items():
        if len(genes) > 1:
            breakdown["hard_penalties"]["H1_teacher_clash"] += (len(genes) - 1) * 1000

    for (cid, day, period), genes in class_slot_genes.items():
        if len(genes) > 1:
            breakdown["hard_penalties"]["H2_class_clash"] += (len(genes) - 1) * 1000

    for (rid, day, period), genes in room_slot_genes.items():
        if len(genes) > 1:
            breakdown["hard_penalties"]["H3_room_clash"] += (len(genes) - 1) * 1000

    for cls in config.classes:
        for entry in cls.curriculum:
            actual = class_subj_count[cls.id][entry.subject_id]
            missing = max(0, entry.min_per_week - actual)
            breakdown["soft_penalties"]["S1_missing_lectures"] += missing * 10

    for tid, teacher in config.teachers.items():
        excess = max(0, teacher_count[tid] - teacher.max_lectures_per_week)
        breakdown["soft_penalties"]["S2_teacher_overload"] += excess * 5

    for tid, day_map in teacher_day_periods.items():
        teacher = config.teachers.get(tid)
        if not teacher:
            continue
        for day, periods in day_map.items():
            sorted_periods = sorted(set(periods))
            run = 1
            for i in range(1, len(sorted_periods)):
                if sorted_periods[i] == sorted_periods[i - 1] + 1:
                    run += 1
                    if run > teacher.max_consecutive_lectures:
                        breakdown["soft_penalties"]["S3_consecutive"] += 3
                else:
                    run = 1

    for cid, day_map in class_day_subjects.items():
        for day, subj_list in day_map.items():
            seen = set()
            for s in subj_list:
                if s in seen:
                    breakdown["soft_penalties"]["S4_same_subj_day"] += 2
                seen.add(s)

    half = config.institution.periods_per_day // 2
    for gene in chromosome:
        teacher = config.teachers.get(gene.teacher_id)
        if teacher and teacher.prefers_morning and gene.period > half:
            breakdown["soft_penalties"]["S8_morning_pref"] += 2

    EARLY_PERIOD_CUTOFF = 4
    for gene in chromosome:
        if gene.period > EARLY_PERIOD_CUTOFF:
            breakdown["soft_penalties"]["S9_late_period"] += (gene.period - EARLY_PERIOD_CUTOFF) * 1

    for cid, day_map in class_day_periods.items():
        for day, periods in day_map.items():
            if not periods:
                continue
            sorted_p = sorted(set(periods))
            gaps = (sorted_p[-1] - sorted_p[0] + 1) - len(sorted_p)
            if gaps > 0:
                breakdown["soft_penalties"]["S5_class_gaps"] += gaps * 1

    for tid, day_map in teacher_day_periods.items():
        for day, periods in day_map.items():
            if not periods:
                continue
            sorted_p = sorted(set(periods))
            gaps = (sorted_p[-1] - sorted_p[0] + 1) - len(sorted_p)
            if gaps > 0:
                breakdown["soft_penalties"]["S6_teacher_gaps"] += gaps * 1

    # S10: Minimize distinct classrooms per section (weight 3)
    class_theory_rooms = defaultdict(set)
    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        if subj and not subj.is_lab:
            class_theory_rooms[gene.class_id].add(gene.room_id)
    for cid, rooms_used in class_theory_rooms.items():
        extra = len(rooms_used) - 1
        if extra > 0:
            breakdown["soft_penalties"]["S10_room_spread"] += extra * 3
    class_occupied_by_theory = set()
    teacher_occupied_by_theory = set()
    room_occupied_by_theory = set()
    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        if subj and not subj.is_lab:
            class_occupied_by_theory.add((gene.class_id, gene.day, gene.period))
            teacher_occupied_by_theory.add((gene.teacher_id, gene.day, gene.period))
            room_occupied_by_theory.add((gene.room_id, gene.day, gene.period))

    for gene in chromosome:
        subj = config.subjects.get(gene.subject_id)
        if subj and subj.is_lab:
            if gene.period % 2 == 0:
                breakdown["hard_penalties"]["H_LAB1_odd_period"] += 500
            next_period = gene.period + 1
            if next_period <= config.institution.periods_per_day:
                if (gene.class_id, gene.day, next_period) in class_occupied_by_theory:
                    breakdown["hard_penalties"]["H_LAB2_next_free"] += 500
                elif (gene.teacher_id, gene.day, next_period) in teacher_occupied_by_theory:
                    breakdown["hard_penalties"]["H_LAB2_next_free"] += 500
                elif (gene.room_id, gene.day, next_period) in room_occupied_by_theory:
                    breakdown["hard_penalties"]["H_LAB2_next_free"] += 500
                else:
                    c_genes = class_slot_genes.get((gene.class_id, gene.day, next_period), [])
                    t_genes = teacher_slot_genes.get((gene.teacher_id, gene.day, next_period), [])
                    r_genes = room_slot_genes.get((gene.room_id, gene.day, next_period), [])

                    if any(g.period != gene.period for g in c_genes):
                         breakdown["hard_penalties"]["H_LAB2_next_free"] += 500
                    elif any(g.period != gene.period for g in t_genes):
                         breakdown["hard_penalties"]["H_LAB2_next_free"] += 500
                    elif any(g.period != gene.period for g in r_genes):
                         breakdown["hard_penalties"]["H_LAB2_next_free"] += 500

    total_penalty = 0
    for p_group in [breakdown["hard_penalties"], breakdown["soft_penalties"]]:
        total_penalty += sum(p_group.values())
        
    breakdown["total_penalty"] = total_penalty
    breakdown["fitness"] = max(0, MAX_SCORE - total_penalty)
    return breakdown