import copy
from collections import defaultdict
from src.models import Gene, Config
from src.fitness import get_penalty_breakdown

def analyze_change(original_chromosome: list[Gene], config: Config, changes: list):
    clone = copy.deepcopy(original_chromosome)
    
    for change in changes:
        if change.day == 0:
            clone.append(Gene(
                class_id=change.class_id,
                subject_id=change.subject_id or "FREE",
                teacher_id=change.new_teacher_id or "",
                room_id=change.new_room_id or "",
                day=change.new_day,
                period=change.new_period
            ))
            continue
            
        # Find gene
        for gene in clone:
            if gene.class_id == change.class_id and gene.day == change.day and gene.period == change.period:
                if change.new_day == 0:
                    clone.remove(gene)
                else:
                    gene.day = change.new_day
                    gene.period = change.new_period
                    if change.new_room_id:
                        gene.room_id = change.new_room_id
                    if change.new_teacher_id:
                        gene.teacher_id = change.new_teacher_id
                break
                
    breakdown_before = get_penalty_breakdown(original_chromosome, config)
    breakdown_after = get_penalty_breakdown(clone, config)
    
    penalty_before = breakdown_before["total_penalty"]
    penalty_after = breakdown_after["total_penalty"]
    
    return penalty_before, penalty_after, clone, breakdown_after, breakdown_before

def compute_ripple_effect(chromosome: list[Gene], config: Config, changes: list):
    # BFS up to depth 2
    direct_conflicts = []
    indirect_impacts = []
    
    visited = set()
    queue = []
    
    # Initialize queue with target slots
    for change in changes:
        resolved_teacher = change.new_teacher_id
        resolved_room = change.new_room_id
        resolved_subject = change.subject_id
        
        # Resolve source gene info
        for gene in chromosome:
            if gene.class_id == change.class_id and gene.day == change.day and gene.period == change.period:
                if not resolved_teacher: resolved_teacher = gene.teacher_id
                if not resolved_room: resolved_room = gene.room_id
                if not resolved_subject: resolved_subject = gene.subject_id
                break
        
        is_moving_lab = False
        if resolved_subject and resolved_subject in config.subjects:
            is_moving_lab = config.subjects[resolved_subject].is_lab

        queue.append({
            "c_id": change.class_id,
            "day": change.new_day,
            "period": change.new_period,
            "r_id": resolved_room,
            "t_id": resolved_teacher,
            "is_lab": is_moving_lab,
            "depth": 0
        })
    
    moving_keys = set((ch.class_id, ch.day, ch.period) for ch in changes)
        
    while queue:
        curr = queue.pop(0)
        c_id, day, period, r_id, t_id, is_lab, depth = curr["c_id"], curr["day"], curr["period"], curr["r_id"], curr["t_id"], curr["is_lab"], curr["depth"]
        
        if depth >= 2 or day == 0:
            continue
            
        for gene in chromosome:
            if (gene.class_id, gene.day, gene.period) in moving_keys:
                continue
            
            if gene.day != day:
                continue

            gene_is_lab = config.subjects[gene.subject_id].is_lab if gene.subject_id in config.subjects else False
            
            # temporal overlap logic for 2-hour labs
            overlap = False
            if gene.period == period:
                overlap = True
            elif gene_is_lab and gene.period + 1 == period:
                overlap = True
            elif is_lab and gene.period == period + 1:
                overlap = True

            if overlap:
                is_conflict = False
                conflict_type = None
                if gene.class_id == c_id:
                    is_conflict = True
                    conflict_type = "class"
                elif t_id and gene.teacher_id == t_id:
                    is_conflict = True
                    conflict_type = "teacher"
                elif r_id and gene.room_id == r_id:
                    is_conflict = True
                    conflict_type = "room"
                    
                if is_conflict:
                    node = {
                        "type": conflict_type,
                        "id": getattr(gene, f"{conflict_type}_id"),
                        "day": gene.day,
                        "period": gene.period,
                        "clashed_with_class": gene.class_id
                    }
                    node_tuple = (node["type"], node["id"], node["day"], node["period"], node["clashed_with_class"])
                    if node_tuple not in visited:
                        visited.add(node_tuple)
                        if depth == 0:
                            direct_conflicts.append(node)
                        else:
                            indirect_impacts.append(node)
                        
                        queue.append({
                            "c_id": gene.class_id,
                            "day": gene.day,
                            "period": gene.period,
                            "r_id": gene.room_id,
                            "t_id": gene.teacher_id,
                            "is_lab": gene_is_lab,
                            "depth": depth + 1
                        })

    return direct_conflicts, indirect_impacts

def generate_suggestions(chromosome: list[Gene], config: Config, changes: list, breakdown_before: dict):
    suggestions = []
    if not changes:
        return []
        
    penalty_before = breakdown_before["total_penalty"]
    
    change = changes[0]
    
    # Target gene to move
    target_gene = None
    for gene in chromosome:
        if gene.class_id == change.class_id and gene.day == change.day and gene.period == change.period:
            target_gene = gene
            break
            
    if not target_gene:
        return []
        
    # Build occupied slots lookup for this class only
    class_occupied = {}
    for gene in chromosome:
        if gene is not target_gene and gene.class_id == target_gene.class_id:
            class_occupied[(gene.day, gene.period)] = gene
            
    days = config.institution.days_per_week
    periods = config.institution.periods_per_day
    
    # Only try empty slots for this class (much fewer evaluations)
    candidate_slots = []
    for d in range(1, days + 1):
        for p in range(1, periods + 1):
            if d == change.day and p == change.period:
                continue
            if (d, p) not in class_occupied:
                candidate_slots.append((d, p, "move", None))

    # Evaluate all candidate slots to find the truly optimal moves
    for d, p, move_type, swap_cid in candidate_slots:
        clone = copy.deepcopy(chromosome)
        for g in clone:
            if g.class_id == target_gene.class_id and g.day == target_gene.day and g.period == target_gene.period:
                g.day = d
                g.period = p
                break
                
        bd = get_penalty_breakdown(clone, config)
        penalty_after = bd["total_penalty"]
        
        # Calculate reasons for improvement or degradation
        reasons = []
        for c_type in ["hard_penalties", "soft_penalties"]:
            for key, before_val in breakdown_before[c_type].items():
                after_val = bd[c_type].get(key, 0)
                if after_val < before_val:
                    # Improved!
                    name = key.split('_')[1:]
                    reasons.append(f"Resolves {' '.join(name) if name else key}")
                elif after_val > before_val:
                    # Degraded!
                    name = key.split('_')[1:]
                    reasons.append(f"Violates {' '.join(name) if name else key}")
                            
        # Append all valid moves
        suggestions.append({
            "day": d,
            "period": p,
            "type": "move",
            "swap_with_class_id": None,
            "penalty": penalty_after,
            "penalty_delta": penalty_after - penalty_before,
            "reasons": reasons,
            "modified_chromosome": [{"class_id": g.class_id, "subject_id": g.subject_id, "teacher_id": g.teacher_id, "room_id": g.room_id, "day": g.day, "period": g.period} for g in clone]
        })
                    
    # Sort by fitness (best fitness first)
    suggestions.sort(key=lambda x: x["penalty"])
    
    # Return top 3 moves
    return suggestions[:3]

def run_local_hill_climbing(chromosome: list[Gene], config: Config, changes: list, direct_conflicts: list):
    # Build affected set
    affected_classes = set()
    affected_teachers = set()
    affected_rooms = set()
    
    for ch in changes:
        affected_classes.add(ch.class_id)
        if ch.new_teacher_id: affected_teachers.add(ch.new_teacher_id)
        if ch.new_room_id: affected_rooms.add(ch.new_room_id)
        
    for c in direct_conflicts:
        if c["type"] == "class": affected_classes.add(c["id"])
        elif c["type"] == "teacher": affected_teachers.add(c["id"])
        elif c["type"] == "room": affected_rooms.add(c["id"])
        
    # Get initial penalty
    bd_init = get_penalty_breakdown(chromosome, config)
    best_penalty = bd_init["total_penalty"]
    best_chromosome = copy.deepcopy(chromosome)
    
    # Limit iterations AND inner pairs to keep response fast
    max_iterations = 10
    for _ in range(max_iterations):
        improved = False
        
        # Only swap genes in the affected set
        affected_genes = [g for g in best_chromosome if g.class_id in affected_classes or g.teacher_id in affected_teachers or g.room_id in affected_rooms]
        
        # Cap pair evaluations to avoid O(n²) blowup
        pairs_tried = 0
        max_pairs = 20
        
        for i in range(len(affected_genes)):
            for j in range(i + 1, len(affected_genes)):
                if pairs_tried >= max_pairs:
                    break
                pairs_tried += 1
                    
                g1 = affected_genes[i]
                g2 = affected_genes[j]
                
                # Try swap
                old_d1, old_p1 = g1.day, g1.period
                old_d2, old_p2 = g2.day, g2.period
                
                g1.day, g1.period = old_d2, old_p2
                g2.day, g2.period = old_d1, old_p1
                
                bd = get_penalty_breakdown(best_chromosome, config)
                new_penalty = bd["total_penalty"]
                
                if new_penalty < best_penalty:
                    best_penalty = new_penalty
                    improved = True
                    break # Restart loop
                else:
                    # Revert
                    g1.day, g1.period = old_d1, old_p1
                    g2.day, g2.period = old_d2, old_p2
            if improved or pairs_tried >= max_pairs:
                break
                
        if not improved:
            break
            
    if best_penalty >= bd_init["total_penalty"]:
        return None, False # Discard
        
    return best_chromosome, True

def find_substitute_teachers(chromosome: list[Gene], config: Config, target_class_id: str, day: int, period: int):
    results = []
    
    # Find the target gene
    target_gene = None
    t_class_id = str(target_class_id).strip()
    print(f"DEBUG: find_substitutes searching for {t_class_id} D{day} P{period}")
    for gene in chromosome:
        if str(gene.class_id).strip() == t_class_id and int(gene.day) == int(day) and int(gene.period) == int(period):
            target_gene = gene
            break
            
    if not target_gene:
        print(f"DEBUG: No target gene found. Available genes for this class: {[ (g.day, g.period) for g in chromosome if str(g.class_id).strip() == t_class_id ]}")
        return []
    
    subject_id = target_gene.subject_id
    current_teacher_id = target_gene.teacher_id
    print(f"DEBUG: Target found! Subject={subject_id}, CurrentTeacher={current_teacher_id}")
    
    # Calculate baseline penalty
    bd_before = get_penalty_breakdown(chromosome, config)
    penalty_before = bd_before["total_penalty"]
    
    # Map teacher busy slots (including labs)
    teacher_busy_slots = defaultdict(set)
    for gene in chromosome:
        if gene is target_gene:
            continue
        subj = config.subjects.get(gene.subject_id)
        weight = 2 if subj and subj.is_lab else 1
        for p_offset in range(weight):
            curr_p = gene.period + p_offset
            if curr_p <= config.institution.periods_per_day:
                teacher_busy_slots[gene.teacher_id].add((gene.day, curr_p))
    
    # Iterate through all teachers
    for t_id, teacher in config.teachers.items():
        if t_id == current_teacher_id:
            continue
            
        print(f"DEBUG: Checking teacher {t_id} ({teacher.name}). Qualified for: {teacher.teaches_subjects}")
        # Check if teacher is qualified for this subject
        qualified = False
        target_s_upper = str(subject_id).strip().upper()
        
        # Check against codes
        if any(str(s).strip().upper() == target_s_upper for s in teacher.teaches_subjects):
            qualified = True
        
        # Also check against names if subject_id is a name
        if not qualified:
            match_subj = config.subjects.get(subject_id)
            if match_subj:
                target_code_upper = str(match_subj.id).strip().upper()
                if any(str(s).strip().upper() == target_code_upper for s in teacher.teaches_subjects):
                    qualified = True

        # Check for specific teacher-related conflicts in this slot
        conflicts = []
        is_free = True
        
        # 1. Teacher busy elsewhere?
        target_subj = config.subjects.get(subject_id)
        target_weight = 2 if target_subj and target_subj.is_lab else 1
        
        for p_offset in range(target_weight):
            p_to_check = day, period + p_offset
            if p_to_check[1] > config.institution.periods_per_day:
                continue
            if p_to_check in teacher_busy_slots[t_id]:
                conflicts.append(f"Teacher is busy at Period {p_to_check[1]}")
                is_free = False
        
        # 2. Teacher unavailable?
        for p_offset in range(target_weight):
            curr_p = period + p_offset
            if any(up["day"] == day and up["period"] == curr_p for up in teacher.unavailable_periods):
                conflicts.append(f"Teacher is unavailable at Period {curr_p}")
                is_free = False

        # Filter: If NOT qualified AND NOT free, skip them to avoid noise
        if not qualified and not is_free:
            continue
            
        print(f"DEBUG: Teacher {t_id} is {'QUALIFIED' if qualified else 'FREE'}. Simulating...")
        # Simulate substitution
        clone = copy.deepcopy(chromosome)
        for g in clone:
            if str(g.class_id).strip() == t_class_id and int(g.day) == int(day) and int(g.period) == int(period):
                g.teacher_id = t_id
                break
                
        # Calculate impact with detailed breakdown
        bd_after = get_penalty_breakdown(clone, config)
        penalty_after = bd_after["total_penalty"]
        
        # Build detailed constraint changes
        constraint_details = []
        for category in ["hard_penalties", "soft_penalties"]:
            for key in bd_before.get(category, {}):
                before_val = bd_before[category].get(key, 0)
                after_val = bd_after[category].get(key, 0)
                delta = after_val - before_val
                if delta != 0:
                    constraint_details.append({
                        "constraint": key,
                        "before": before_val,
                        "after": after_val,
                        "delta": delta,
                        "is_hard": category == "hard_penalties",
                        "status": "worsened" if delta > 0 else "improved"
                    })
                    if delta > 0:
                        conflicts.append(f"{key}: +{delta} penalty ({before_val} → {after_val})")
        
        results.append({
            "teacher_id": t_id,
            "teacher_name": teacher.name,
            "penalty_delta": penalty_after - penalty_before,
            "conflicts": conflicts,
            "constraint_details": constraint_details,
            "is_qualified": qualified,
            "is_free": is_free,
            "modified_chromosome": [{"class_id": g.class_id, "subject_id": g.subject_id, "teacher_id": g.teacher_id, "room_id": g.room_id, "day": g.day, "period": g.period} for g in clone]
        })
        
    # Sort: Qualified first, then by penalty delta
    return sorted(results, key=lambda x: (not x["is_qualified"], x["penalty_delta"]))

