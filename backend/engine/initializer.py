import random

from backend.engine.models import Config, Gene


def pick_valid_room(config: Config, subject_id: str, student_count: int):
    subj = config.subjects[subject_id]
    valid_rooms = [
        r
        for r in config.rooms.values()
        if r.type == subj.requires_room_type and r.capacity >= student_count
    ]
    if not valid_rooms:
        # fallback: any room of correct type
        valid_rooms = [
            r for r in config.rooms.values() if r.type == subj.requires_room_type
        ]
    if not valid_rooms:
        # last fallback: any room
        valid_rooms = list(config.rooms.values())
    return random.choice(valid_rooms)


def create_random_chromosome(config: Config):
    genes = []
    inst = config.institution

    for cls in config.classes:
        for entry in cls.curriculum:
            subj = config.subjects[entry.subject_id]
            room = pick_valid_room(config, entry.subject_id, cls.student_count)
            odd_periods = [
                p
                for p in range(1, inst.periods_per_day + 1)
                if p % 2 == 1 and p + 1 <= inst.periods_per_day
            ]

            for _ in range(entry.min_per_week):
                class_occ, teacher_occ, room_occ = set(), set(), set()
                for g in genes:
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

                if subj.is_lab:
                    valid_slots = [
                        (d, p)
                        for d in range(1, inst.days_per_week + 1)
                        for p in odd_periods
                        if is_valid(d, p, True)
                    ]
                else:
                    valid_slots = [
                        (d, p)
                        for d in range(1, inst.days_per_week + 1)
                        for p in range(1, inst.periods_per_day + 1)
                        if is_valid(d, p, False)
                    ]

                if not valid_slots:
                    if subj.is_lab:
                        valid_slots = [
                            (d, p)
                            for d in range(1, inst.days_per_week + 1)
                            for p in odd_periods
                            if (d, p) not in class_occ
                        ]
                    else:
                        valid_slots = [
                            (d, p)
                            for d in range(1, inst.days_per_week + 1)
                            for p in range(1, inst.periods_per_day + 1)
                            if (d, p) not in class_occ
                        ]

                if valid_slots:
                    day, period = random.choice(valid_slots)
                else:
                    day = random.randint(1, inst.days_per_week)
                    period = (
                        random.choice(odd_periods)
                        if subj.is_lab
                        else random.randint(1, inst.periods_per_day)
                    )

                genes.append(
                    Gene(
                        class_id=cls.id,
                        subject_id=entry.subject_id,
                        teacher_id=entry.teacher_id,
                        room_id=room.id,
                        day=day,
                        period=period,
                    )
                )

    return genes