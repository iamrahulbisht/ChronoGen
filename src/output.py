import csv
import os
from collections import defaultdict

from src.fitness import MAX_SCORE
from src.models import Config

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
    from src.fitness import get_penalty_breakdown

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


def generate_html_report(config: Config, output_dir: str = "output/visual_charts", chromosome=None):
    from src.fitness import get_penalty_breakdown
    os.makedirs(output_dir, exist_ok=True)

    # Build stats section
    stats_html = ""
    timetable_html = ""
    if chromosome:
        bd = get_penalty_breakdown(chromosome, config)
        hard_v = sum(bd["hard_penalties"].values())
        soft_v = sum(bd["soft_penalties"].values())
        fitness = bd["fitness"]

        stats_html = f"""
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">Fitness Score</div><div class="stat-value" style="color:#22c55e">{fitness:,}</div></div>
            <div class="stat-card"><div class="stat-label">Hard Violations</div><div class="stat-value" style="color:{'#ef4444' if hard_v > 0 else '#22c55e'}">{hard_v}</div></div>
            <div class="stat-card"><div class="stat-label">Soft Penalties</div><div class="stat-value" style="color:#f59e0b">{soft_v}</div></div>
        </div>
        """

        # Build timetable grids
        teachers = {t_id: t.name for t_id, t in config.teachers.items()}
        rooms_map = {r_id: r.name for r_id, r in config.rooms.items()}

        timetable_html += "<h2 class='section-title'>Class Timetables</h2>"
        for cls in config.classes:
            grid = {}
            for gene in chromosome:
                if gene.class_id == cls.id:
                    t_name = teachers.get(gene.teacher_id, gene.teacher_id)
                    r_name = rooms_map.get(gene.room_id, gene.room_id)
                    grid[(gene.day, gene.period)] = f"<b>{gene.subject_id}</b><br><small>{t_name} &bull; {r_name}</small>"
                    subj = config.subjects.get(gene.subject_id)
                    if subj and subj.is_lab:
                        grid[(gene.day, gene.period + 1)] = f"<b>{gene.subject_id} (Lab)</b><br><small>{t_name} &bull; {r_name}</small>"

            table = f"<div class='timetable-card'><h3>{cls.name} ({cls.id})</h3><table><tr><th></th>"
            for p in range(1, config.institution.periods_per_day + 1):
                table += f"<th>P{p}</th>"
            table += "</tr>"
            for d in range(1, config.institution.days_per_week + 1):
                table += f"<tr><td class='day-name'>{DAY_NAMES.get(d, f'D{d}')}</td>"
                for p in range(1, config.institution.periods_per_day + 1):
                    cell = grid.get((d, p), "<span class='free'>FREE</span>")
                    table += f"<td>{cell}</td>"
                table += "</tr>"
            table += "</table></div>"
            timetable_html += table

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ChronoGen Timetable Report</title>
    <style>
        :root {{ --bg:#0a0a0f; --surface:#14141d; --accent:#6c63ff; --text:#e1e1e6; --dim:#88889a; --border:#242430; }}
        body {{ font-family:'Segoe UI',sans-serif; background:var(--bg); color:var(--text); margin:0; padding:40px; }}
        .header {{ text-align:center; margin-bottom:40px; padding-bottom:30px; border-bottom:1px solid var(--border); }}
        h1 {{ font-size:2.5rem; font-weight:900; color:var(--accent); margin:0; letter-spacing:-1px; }}
        .stats-grid {{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:40px; }}
        .stat-card {{ background:var(--surface); padding:24px; border-radius:16px; border:1px solid var(--border); text-align:center; }}
        .stat-label {{ font-size:10px; font-weight:700; color:var(--dim); text-transform:uppercase; letter-spacing:2px; }}
        .stat-value {{ font-size:2rem; font-weight:900; margin-top:8px; }}
        .section-title {{ font-size:1.2rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; margin:40px 0 20px; border-left:4px solid var(--accent); padding-left:12px; }}
        .chart-section {{ background:var(--surface); padding:30px; border-radius:20px; border:1px solid var(--border); margin-bottom:40px; }}
        .timetable-card {{ background:var(--surface); padding:20px; border-radius:16px; border:1px solid var(--border); margin-bottom:20px; overflow-x:auto; }}
        .timetable-card h3 {{ font-size:14px; font-weight:800; color:var(--accent); margin:0 0 12px; text-transform:uppercase; letter-spacing:1px; }}
        table {{ width:100%; border-collapse:separate; border-spacing:2px; table-layout:fixed; }}
        th {{ background:rgba(108,99,255,0.1); padding:8px; font-size:10px; font-weight:800; color:var(--accent); text-transform:uppercase; border-radius:6px; }}
        td {{ background:rgba(255,255,255,0.02); padding:10px 6px; text-align:center; border-radius:6px; font-size:11px; vertical-align:middle; }}
        .day-name {{ font-weight:800; color:var(--dim); text-transform:uppercase; font-size:10px; background:transparent; }}
        .free {{ opacity:0.15; font-weight:800; }}
        img.plot {{ width:100%; border-radius:12px; }}
        .footer {{ text-align:center; margin-top:60px; color:var(--dim); font-size:11px; border-top:1px solid var(--border); padding-top:30px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>CHRONOGEN</h1>
        <p style="color:var(--dim);font-weight:700;letter-spacing:3px;margin-top:8px">TIMETABLE REPORT &bull; {config.institution.name}</p>
    </div>
    {stats_html}
    <div class="chart-section">
        <h2 class="section-title">Fitness Convergence</h2>
        <img src="convergence_plot.png" class="plot" alt="Convergence Plot">
    </div>
    {timetable_html}
    <div class="footer">
        <p>&copy; 2026 ChronoGen Analytics Engine</p>
    </div>
</body>
</html>"""
    filepath = os.path.join(output_dir, "timetable_report.html")
    with open(filepath, "w", encoding="utf-8") as f:
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