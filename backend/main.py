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