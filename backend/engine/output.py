import csv
import os
from collections import defaultdict

from backend.engine.fitness import MAX_SCORE
from backend.engine.models import Config

DAY_NAMES = {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"}


def print_class_timetable(chromosome, class_id: str, config: Config):
    inst = config.institution
    days = inst.days_per_week
    periods = inst.periods_per_day

    grid = {}
    for gene in chromosome:
        if gene.class_id == class_id:
            grid[(gene.day, gene.period)] = f"{gene.subject_id}"
            subj = config.subjects.get(gene.subject_id)
            if subj and subj.is_lab:
                grid[(gene.day, gene.period + 1)] = f"{gene.subject_id}(L)"

    print(f"  Timetable: {class_id}")

    # Header row
    header = f"{'':6}"
    for p in range(1, periods + 1):
        header += f"  P{p:>4}"
    print(header)

    for d in range(1, days + 1):
        day_name = DAY_NAMES.get(d, f"D{d}")
        row = f"{day_name:6}"
        for p in range(1, periods + 1):
            cell = grid.get((d, p), "FREE")
            row += f"  {cell:>6}"
        print(row)


def print_teacher_timetable(chromosome, teacher_id: str, config: Config):
    inst = config.institution
    days = inst.days_per_week
    periods = inst.periods_per_day
    teacher = config.teachers.get(teacher_id)
    name = teacher.name if teacher else teacher_id

    grid = {}
    for gene in chromosome:
        if gene.teacher_id == teacher_id:
            grid[(gene.day, gene.period)] = f"{gene.class_id}/{gene.subject_id}"
            subj = config.subjects.get(gene.subject_id)
            if subj and subj.is_lab:
                grid[(gene.day, gene.period + 1)] = (
                    f"{gene.class_id}/{gene.subject_id}(L)"
                )

    print(f"  Teacher Timetable: {name}")

    header = f"{'':6}"
    for p in range(1, periods + 1):
        header += f"  {'P'+str(p):>10}"
    print(header)

    for d in range(1, days + 1):
        day_name = DAY_NAMES.get(d, f"D{d}")
        row = f"{day_name:6}"
        for p in range(1, periods + 1):
            cell = grid.get((d, p), "FREE")
            row += f"  {cell:>10}"
        print(row)


def print_all_timetables(chromosome, config: Config):
    print("  CLASS TIMETABLES")
    for cls in config.classes:
        print_class_timetable(chromosome, cls.id, config)
    print("  TEACHER TIMETABLES")
    for tid in config.teachers:
        print_teacher_timetable(chromosome, tid, config)


def print_fitness_summary(chromosome, config: Config):
    from backend.engine.fitness import get_penalty_breakdown

    bd = get_penalty_breakdown(chromosome, config)

    print("  CONSTRAINT VIOLATION SUMMARY")
    print(f"  {'Constraint':<30} {'Penalty':>8}")
    for key, val in bd.items():
        if key in ("total_penalty", "fitness"):
            continue
        icon = "[X]" if val > 0 else "[OK]"
        print(f"  {icon} {key:<30} {val:>8}")
    print(f"  {'Total Penalty':<30} {bd['total_penalty']:>8}")
    print(f"  {'Fitness Score':<30} {bd['fitness']:>8} / {MAX_SCORE}")


def save_timetable_csv(
    chromosome, config: Config, output_dir: str = "output/timetable_for_students"
):
    os.makedirs(output_dir, exist_ok=True)
    inst = config.institution
    days = inst.days_per_week
    periods = inst.periods_per_day

    for cls in config.classes:
        grid = {}
        for gene in chromosome:
            if gene.class_id == cls.id:
                grid[(gene.day, gene.period)] = (
                    f"{gene.subject_id} ({gene.teacher_id}) [{gene.room_id}]"
                )
                subj = config.subjects.get(gene.subject_id)
                if subj and subj.is_lab:
                    grid[(gene.day, gene.period + 1)] = (
                        f"{gene.subject_id}(L) ({gene.teacher_id}) [{gene.room_id}]"
                    )

        filepath = os.path.join(output_dir, f"student_timetable_{cls.id}.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Day"] + [f"Period {p}" for p in range(1, periods + 1)])
            for d in range(1, days + 1):
                row = [DAY_NAMES.get(d, f"D{d}")]
                for p in range(1, periods + 1):
                    row.append(grid.get((d, p), "FREE"))
                writer.writerow(row)
        print(f"  Saved: {filepath}")


def save_teacher_timetable_csv(
    chromosome, config: Config, output_dir: str = "output/timetable_for_teachers"
):
    os.makedirs(output_dir, exist_ok=True)
    inst = config.institution
    days = inst.days_per_week
    periods = inst.periods_per_day

    for tid, teacher in config.teachers.items():
        grid = {}
        for gene in chromosome:
            if gene.teacher_id == tid:
                grid[(gene.day, gene.period)] = (
                    f"{gene.class_id}/{gene.subject_id} [{gene.room_id}]"
                )
                subj = config.subjects.get(gene.subject_id)
                if subj and subj.is_lab:
                    grid[(gene.day, gene.period + 1)] = (
                        f"{gene.class_id}/{gene.subject_id}(L) [{gene.room_id}]"
                    )

        name_safe = (
            teacher.name.replace(" ", "_").replace(".", "") if teacher.name else tid
        )
        filepath = os.path.join(output_dir, f"teacher_timetable_{name_safe}.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Day"] + [f"Period {p}" for p in range(1, periods + 1)])
            for d in range(1, days + 1):
                row = [DAY_NAMES.get(d, f"D{d}")]
                for p in range(1, periods + 1):
                    row.append(grid.get((d, p), "FREE"))
                writer.writerow(row)
        print(f"  Saved: {filepath}")


def plot_fitness_history(fitness_history):
    if not fitness_history:
        return

    best_history = [h["best"] if isinstance(h, dict) else h for h in fitness_history]

    if len(best_history) == 1:
        print("\n  Fitness over Generations")
        print(
            f"  Evolution stopped early. Only 1 generation ran with fitness: {best_history[0]}"
        )
        print()
        return

    max_val = max(best_history)
    min_val = min(best_history)
    if max_val == min_val:
        min_val = 0
    height = 15
    width = min(len(best_history), 60)

    step = max(1, len(best_history) // width)
    sampled = best_history[::step][:width]

    print("\n  Fitness over Generations")
    print(f"  {'-'*width}")

    for row in range(height, 0, -1):
        threshold = min_val + (max_val - min_val) * (row / height)
        line = ""
        for val in sampled:
            line += "#" if val >= threshold else " "
        label = f"{threshold:6.0f} |"
        print(f"  {label}{line}")

    print(f"  {'':7}{'-'*width}")
    print(f"  {'':7}0{' '*(width-10)}Gen {len(best_history)-1}")
    print()


def plot_fitness_history_matplotlib(
    fitness_history, output_dir: str = "output/visual_charts"
):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    os.makedirs(output_dir, exist_ok=True)

    if not fitness_history or not isinstance(fitness_history[0], dict):
        return  # Fallback if unsupported format

    bests = [h["best"] for h in fitness_history]
    means = [h["mean"] for h in fitness_history]
    worsts = [h["worst"] for h in fitness_history]
    generations = list(range(len(fitness_history)))

    plt.figure(figsize=(10, 6))
    plt.plot(generations, bests, label="Best Fitness", color="green", linewidth=2)
    plt.plot(generations, means, label="Mean Fitness", color="blue", linestyle="--")
    plt.plot(generations, worsts, label="Worst Fitness", color="red", alpha=0.5)

    plt.title("ChronoGen GA Fitness Convergence")
    plt.xlabel("Generation")
    plt.ylabel("Fitness Score")
    plt.legend()
    plt.grid(True, linestyle=":", alpha=0.6)

    filepath = os.path.join(output_dir, "convergence_plot.png")
    plt.savefig(filepath, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {filepath}")


def save_chromosome_json(chromosome, output_dir: str = "output/visual_charts"):
    import json

    os.makedirs(output_dir, exist_ok=True)

    genes_data = []
    for g in chromosome:
        genes_data.append(
            {
                "class_id": g.class_id,
                "subject_id": g.subject_id,
                "teacher_id": g.teacher_id,
                "room_id": g.room_id,
                "day": g.day,
                "period": g.period,
            }
        )

    filepath = os.path.join(output_dir, "chromosome.json")
    with open(filepath, "w") as f:
        json.dump(genes_data, f, indent=4)
    print(f"  Saved: {filepath}")


def generate_html_report(config: Config, output_dir: str = "output/visual_charts"):
    os.makedirs(output_dir, exist_ok=True)
    html_content = f"""
    <html>
    <head>
        <title>ChronoGen Timetable Report</title>
        <style>
            body {{ font-family: sans-serif; padding: 20px; }}
            h1 {{ color: #2c3e50; }}
            img {{ max-width: 100%; height: auto; border: 1px solid #ccc; }}
        </style>
    </head>
    <body>
        <h1>ChronoGen Genetic Algorithm Report</h1>
        <h2>Fitness Convergence</h2>
        <img src="convergence_plot.png" alt="Fitness Plot">
        <p>The convergence chart illustrates the optimization journey.</p>
        <p>Please refer to the <b>timetable_for_students/</b>, <b>timetable_for_teachers/</b>, and <b>timetable_for_rooms/</b> folders for exact CSV tables.</p>
    </body>
    </html>
    """
    filepath = os.path.join(output_dir, "timetable_report.html")
    with open(filepath, "w") as f:
        f.write(html_content)
    print(f"  Saved: {filepath}")


def save_room_timetable_csv(
    chromosome, config: Config, output_dir: str = "output/timetable_for_rooms"
):
    """Save each room timetable as a CSV file."""
    os.makedirs(output_dir, exist_ok=True)
    inst = config.institution
    days = inst.days_per_week
    periods = inst.periods_per_day

    for room_id, room in config.rooms.items():
        grid = {}
        for gene in chromosome:
            if gene.room_id == room_id:
                grid[(gene.day, gene.period)] = (
                    f"{gene.class_id}/{gene.subject_id} ({gene.teacher_id})"
                )
                subj = config.subjects.get(gene.subject_id)
                if subj and subj.is_lab:
                    grid[(gene.day, gene.period + 1)] = (
                        f"{gene.class_id}/{gene.subject_id}(L) ({gene.teacher_id})"
                    )

        name_safe = (
            room.name.replace(" ", "_").replace(".", "") if room.name else room.id
        )
        filepath = os.path.join(output_dir, f"room_timetable_{name_safe}.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Day"] + [f"Period {p}" for p in range(1, periods + 1)])
            for d in range(1, days + 1):
                row = [DAY_NAMES.get(d, f"D{d}")]
                for p in range(1, periods + 1):
                    row.append(grid.get((d, p), "FREE"))
                writer.writerow(row)
        print(f"  Saved: {filepath}")