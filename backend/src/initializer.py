import random

from src.models import Config, Gene


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