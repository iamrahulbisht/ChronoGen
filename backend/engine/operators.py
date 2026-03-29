import random

from backend.engine.initializer import pick_valid_room
from backend.engine.models import Config, Gene

# SELECTION 


def tournament_select(population, fitnesses, k=5):
    contestants = random.sample(range(len(population)), k)
    best_idx = max(contestants, key=lambda i: fitnesses[i])
    return population[best_idx]


# CROSSOVER 


def day_block_crossover(parent_a, parent_b, config: Config):
    days = config.institution.days_per_week
    child = []

    for day in range(1, days + 1):
        if random.random() < 0.5:
            day_genes = [g for g in parent_a if g.day == day]
        else:
            day_genes = [g for g in parent_b if g.day == day]
        child.extend(day_genes)

    child = repair_chromosome(child, config)
    return child


def repair_chromosome(chromosome, config: Config):
    from collections import defaultdict

    # Count what we currently have
    have = defaultdict(lambda: defaultdict(list))
    for gene in chromosome:
        have[gene.class_id][gene.subject_id].append(gene)

    repaired = []

    days_per_week = config.institution.days_per_week
    periods_per_day = config.institution.periods_per_day

    for cls in config.classes:
        for entry in cls.curriculum:
            genes_for_this = have[cls.id][entry.subject_id]
            needed = entry.min_per_week
            actual = len(genes_for_this)

            if actual >= needed:
                repaired.extend(random.sample(genes_for_this, needed))
            else:
                repaired.extend(genes_for_this)
                shortage = needed - actual
                room = pick_valid_room(config, entry.subject_id, cls.student_count)
                subj = config.subjects.get(entry.subject_id)
                is_lab = subj.is_lab if subj else False
                odd_periods = [
                    p
                    for p in range(1, periods_per_day + 1)
                    if p % 2 == 1 and p + 1 <= periods_per_day
                ]

                for _ in range(shortage):
                    class_occ, teacher_occ, room_occ = set(), set(), set()
                    for g in repaired:
                        g_is_lab = (
                            config.subjects.get(g.subject_id)
                            and config.subjects[g.subject_id].is_lab
                        )
                        if g.class_id == cls.id:
                            class_occ.add((g.day, g.period))
                            if g_is_lab:
                                class_occ.add((g.day, g.period + 1))
                        if g.teacher_id == entry.teacher_id:
                            teacher_occ.add((g.day, g.period))
                            if g_is_lab:
                                teacher_occ.add((g.day, g.period + 1))
                        if g.room_id == room.id:
                            room_occ.add((g.day, g.period))
                            if g_is_lab:
                                room_occ.add((g.day, g.period + 1))

                    def is_valid(d, p, is_lab_gene):
                        if (
                            (d, p) in class_occ
                            or (d, p) in teacher_occ
                            or (d, p) in room_occ
                        ):
                            return False
                        if is_lab_gene:
                            if (
                                (d, p + 1) in class_occ
                                or (d, p + 1) in teacher_occ
                                or (d, p + 1) in room_occ
                            ):
                                return False
                        return True

                    if is_lab:
                        valid_slots = [
                            (d, p)
                            for d in range(1, days_per_week + 1)
                            for p in odd_periods
                            if is_valid(d, p, True)
                        ]
                    else:
                        valid_slots = [
                            (d, p)
                            for d in range(1, days_per_week + 1)
                            for p in range(1, periods_per_day + 1)
                            if is_valid(d, p, False)
                        ]

                    if not valid_slots:
                        if is_lab:
                            valid_slots = [
                                (d, p)
                                for d in range(1, days_per_week + 1)
                                for p in odd_periods
                                if (d, p) not in class_occ
                            ]
                        else:
                            valid_slots = [
                                (d, p)
                                for d in range(1, days_per_week + 1)
                                for p in range(1, periods_per_day + 1)
                                if (d, p) not in class_occ
                            ]

                    if valid_slots:
                        day, period = random.choice(valid_slots)
                    else:
                        day = random.randint(1, days_per_week)
                        period = (
                            random.choice(odd_periods)
                            if is_lab
                            else random.randint(1, periods_per_day)
                        )

                    repaired.append(
                        Gene(
                            class_id=cls.id,
                            subject_id=entry.subject_id,
                            teacher_id=entry.teacher_id,
                            room_id=room.id,
                            day=day,
                            period=period,
                        )
                    )

    return repaired


# MUTATION 


def mutate(chromosome, mutation_rate: float, config: Config):
    inst = config.institution
    mutated = []

    odd_periods = [
        p
        for p in range(1, inst.periods_per_day + 1)
        if p % 2 == 1 and p + 1 <= inst.periods_per_day
    ]

    for gene in chromosome:
        if random.random() < mutation_rate:
            subj = config.subjects.get(gene.subject_id)
            is_lab = subj.is_lab if subj else False
            choice = random.randint(0, 2)

            if choice == 0:
                new_day = random.randint(1, inst.days_per_week)
                if is_lab:
                    new_period = random.choice(odd_periods)
                else:
                    new_period = random.randint(1, inst.periods_per_day)
                gene = Gene(
                    gene.class_id,
                    gene.subject_id,
                    gene.teacher_id,
                    gene.room_id,
                    new_day,
                    new_period,
                )

            elif choice == 1:
                cls = next((c for c in config.classes if c.id == gene.class_id), None)
                student_count = cls.student_count if cls else 0
                new_room = pick_valid_room(config, gene.subject_id, student_count)
                gene = Gene(
                    gene.class_id,
                    gene.subject_id,
                    gene.teacher_id,
                    new_room.id,
                    gene.day,
                    gene.period,
                )

            elif choice == 2:
                days_with_subj = {
                    g.day
                    for g in chromosome
                    if g.class_id == gene.class_id and g.subject_id == gene.subject_id
                }
                valid_days = [
                    d
                    for d in range(1, inst.days_per_week + 1)
                    if d not in days_with_subj
                ]
                new_day = (
                    random.choice(valid_days)
                    if valid_days
                    else random.randint(1, inst.days_per_week)
                )
                gene = Gene(
                    gene.class_id,
                    gene.subject_id,
                    gene.teacher_id,
                    gene.room_id,
                    new_day,
                    gene.period,
                )

        mutated.append(gene)

    return mutated


def mutate_slot_swap(chromosome, mutation_rate: float, config: Config):
    inst = config.institution
    mutated = []
    odd_periods = [
        p
        for p in range(1, inst.periods_per_day + 1)
        if p % 2 == 1 and p + 1 <= inst.periods_per_day
    ]

    for gene in chromosome:
        if random.random() < mutation_rate:
            subj = config.subjects.get(gene.subject_id)
            is_lab = subj.is_lab if subj else False
            new_day = random.randint(1, inst.days_per_week)
            if is_lab:
                new_period = random.choice(odd_periods)
            else:
                new_period = random.randint(1, inst.periods_per_day)
            gene = Gene(
                gene.class_id,
                gene.subject_id,
                gene.teacher_id,
                gene.room_id,
                new_day,
                new_period,
            )
        mutated.append(gene)
    return mutated


def mutate_room_reassign(chromosome, mutation_rate: float, config: Config):
    mutated = []
    for gene in chromosome:
        if random.random() < mutation_rate:
            cls = next((c for c in config.classes if c.id == gene.class_id), None)
            student_count = cls.student_count if cls else 0
            new_room = pick_valid_room(config, gene.subject_id, student_count)
            gene = Gene(
                gene.class_id,
                gene.subject_id,
                gene.teacher_id,
                new_room.id,
                gene.day,
                gene.period,
            )
        mutated.append(gene)
    return mutated


def mutate_day_move(chromosome, mutation_rate: float, config: Config):
    inst = config.institution
    mutated = []
    for gene in chromosome:
        if random.random() < mutation_rate:
            days_with_subj = {
                g.day
                for g in chromosome
                if g.class_id == gene.class_id and g.subject_id == gene.subject_id
            }
            valid_days = [
                d for d in range(1, inst.days_per_week + 1) if d not in days_with_subj
            ]
            new_day = (
                random.choice(valid_days)
                if valid_days
                else random.randint(1, inst.days_per_week)
            )
            gene = Gene(
                gene.class_id,
                gene.subject_id,
                gene.teacher_id,
                gene.room_id,
                new_day,
                gene.period,
            )
        mutated.append(gene)
    return mutated