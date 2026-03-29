"""
Return 0 - Kaam chota ya bada nhi hota, commit hona chahiye
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from src.engine import (
    run_ga,
    run_hyper_heuristic_ga,
    run_island_ga,
    run_memetic_ga,
    run_nsga2,
)
from src.loader import load_config
from src.output import (
    generate_html_report,
    plot_fitness_history,
    plot_fitness_history_matplotlib,
    print_all_timetables,
    print_fitness_summary,
    save_chromosome_json,
    save_teacher_timetable_csv,
    save_timetable_csv,
)
from src.validator import validate


def main():
    data_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "data", "sample_input.json"
    )

    print("  ChronoGen – Genetic Algorithm Timetable Generator")

    # Step 1: Load data
    print(f"\n[1] Loading data from: {data_file}")
    config = load_config(data_file)

    # Step 2: Validate
    print("[2] Validating input...")
    ok = validate(config)
    if not ok:
        print("Fix the errors above and try again.")
        sys.exit(1)

    # Step 3: Run GA
    print("\nSelect Algorithm:")
    print("1. Basic GA")
    print("2. Memetic GA (GA + Local Hill Climb)")
    print("3. Island Model GA (4 Islands)")
    print("4. Hyper-heuristic GA (Adaptive Operator Selection)")
    print("5. NSGA-II (Multi-Objective Pareto Search)")

    choice = input("Enter choice (1-5) [1]: ").strip()

    if choice == "2":
        print("\n[3] Running Memetic Genetic Algorithm...")
        best_chromosome, fitness_history = run_memetic_ga(config, verbose=True)
    elif choice == "3":
        print("\n[3] Running Island Model Genetic Algorithm...")
        best_chromosome, fitness_history = run_island_ga(config, verbose=True)
    elif choice == "4":
        print("\n[3] Running Hyper-heuristic Genetic Algorithm...")
        best_chromosome, fitness_history = run_hyper_heuristic_ga(config, verbose=True)
    elif choice == "5":
        print("\n[3] Running NSGA-II (Multi-Objective Pareto Search)...")
        pareto_front, pareto_objs, fitness_history = run_nsga2(config, verbose=True)
        print("\nFound", len(pareto_front), "Pareto Optimal Solutions:")
        for i, obj in enumerate(pareto_objs):
            print(f"[{i}] Hard Penalty: {obj[0]}, Soft Penalty: {obj[1]}")
        print("\nAutomatically selecting the optimal timetable (Minimum Hard Penalty, then Minimum Soft Penalty)...")
        idx = min(range(len(pareto_objs)), key=lambda i: (pareto_objs[i][0], pareto_objs[i][1]))
        print(f"Selected: [{idx}] Hard Penalty: {pareto_objs[idx][0]}, Soft Penalty: {pareto_objs[idx][1]}")
        best_chromosome = pareto_front[idx]
    else:
        print("\n[3] Running Basic Genetic Algorithm...")
        best_chromosome, fitness_history = run_ga(config, verbose=True)

    # Step 4: Show results
    print("\n[4] Results")
    print_fitness_summary(best_chromosome, config)
    print_all_timetables(best_chromosome, config)

    # Step 5: ASCII fitness plot
    print("\n[5] Fitness Convergence Chart (ASCII & PNG Export)")
    plot_fitness_history(fitness_history)
    plot_fitness_history_matplotlib(fitness_history, "output/visual_charts")

    # Step 6: Exports
    print("\n[6] Exporting Final Artifacts...")
    save_timetable_csv(best_chromosome, config, "output/timetable_for_students")
    save_teacher_timetable_csv(best_chromosome, config, "output/timetable_for_teachers")
    save_chromosome_json(best_chromosome, "output/visual_charts")
    generate_html_report(config, "output/visual_charts")

    print("\nDone! All outputs generated in the 'output' directory.")


if __name__ == "__main__":
    main()
