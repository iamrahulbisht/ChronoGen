import random

from src.fitness import MAX_SCORE, evaluate_fitness
from src.initializer import create_random_chromosome
from src.models import Config
from src.operators import day_block_crossover, mutate, tournament_select


# Global for workers
_worker_config = None

def _init_worker(config):
    global _worker_config
    _worker_config = config

def _worker_eval_fitness(chrom):
    return evaluate_fitness(chrom, _worker_config)

def _worker_eval_nsga2(chrom):
    from src.engine import evaluate_nsga2_objectives
    return evaluate_nsga2_objectives(chrom, _worker_config)

def run_ga(config: Config, verbose: bool = True, progress_callback=None):
    random.seed(config.ga.random_seed)

    ga = config.ga

    # Step 1: Initialize population
    population = [create_random_chromosome(config) for _ in range(ga.population_size)]

    best_chromosome = None
    best_fitness = -1
    fitness_history = []
    stagnation_counter = 0
    mutation_rate = ga.mutation_rate

    if verbose:
        total_genes = sum(
            e.min_per_week for cls in config.classes for e in cls.curriculum
        )
        print(
            f"\nStarting GA: {ga.population_size} chromosomes, "
            f"{ga.max_generations} generations, "
            f"{total_genes} genes/chromosome\n"
        )
        print(f"{'Gen':>5}  {'Best':>7}  {'Gen Best':>8}  {'Mutation':>8}  {'Status'}")
        print("-" * 55)

    # GA Main Loop
    for generation in range(ga.max_generations):

        # Evaluate all chromosomes
        fitnesses = [evaluate_fitness(chrom, config) for chrom in population]

        # Find best in this generation
        gen_best_idx = max(range(len(fitnesses)), key=lambda i: fitnesses[i])
        gen_best_fitness = fitnesses[gen_best_idx]

        # Track global best
        if gen_best_fitness > best_fitness:
            best_fitness = gen_best_fitness
            best_chromosome = [g for g in population[gen_best_idx]] 
            stagnation_counter = 0
            status = "^ improved"
        else:
            stagnation_counter += 1
            status = ""

        mean_fit = sum(fitnesses) / len(fitnesses)
        worst_fit = min(fitnesses)
        fitness_history.append(
            {"best": best_fitness, "mean": mean_fit, "worst": worst_fit}
        )

        if verbose and (generation % 10 == 0 or gen_best_fitness >= ga.target_fitness):
            print(
                f"{generation:>5}  {best_fitness:>7}  {gen_best_fitness:>8}  "
                f"{mutation_rate:>8.3f}  {status}"
            )

        if progress_callback and generation % 10 == 0:
            progress_callback(generation, ga.max_generations, best_fitness)

        if best_fitness >= ga.target_fitness and generation > 0:
            if verbose:
                print(
                    f"\n[✓] Target fitness {ga.target_fitness} reached at generation {generation}!"
                )
            break

        # Stagnation detection -> boost mutation temporarily
        if stagnation_counter >= ga.stagnation_window:
            mutation_rate = ga.stagnation_mutation_boost
            if verbose and stagnation_counter == ga.stagnation_window:
                print(
                    f"  [!] Stagnation at gen {generation} -> mutation boosted to {mutation_rate}"
                )
        else:
            mutation_rate = ga.mutation_rate

        # Build next generation

        # Sort by fitness (best first)
        sorted_indices = sorted(
            range(len(fitnesses)), key=lambda i: fitnesses[i], reverse=True
        )

        next_population = []

        # Elitism: always keep the top N unchanged
        for i in range(ga.elitism_count):
            next_population.append(population[sorted_indices[i]])

        # Fill rest with crossover + mutation children
        while len(next_population) < ga.population_size:
            parent_a = tournament_select(population, fitnesses, ga.tournament_size)
            parent_b = tournament_select(population, fitnesses, ga.tournament_size)

            if random.random() < ga.crossover_rate:
                child = day_block_crossover(parent_a, parent_b, config)
            else:
                child = list(parent_a) 

            child = mutate(child, mutation_rate, config)
            next_population.append(child)

        population = next_population

    if verbose:
        print(f"Final best fitness: {best_fitness} / {MAX_SCORE}\n")

    return best_chromosome, fitness_history


def hill_climb(chrom, config: Config, steps: int = 50):
    # Deep copy the chromosome list and all its gene objects to avoid corrupting the population
    import copy
    best_chrom = copy.deepcopy(chrom)
    best_fitness = evaluate_fitness(best_chrom, config)

    n = len(best_chrom)
    if n < 2:
        return best_chrom

    for _ in range(steps):
        i, j = random.sample(range(n), 2)

        # Swap day and period
        best_chrom[i].day, best_chrom[j].day = best_chrom[j].day, best_chrom[i].day
        best_chrom[i].period, best_chrom[j].period = (
            best_chrom[j].period,
            best_chrom[i].period,
        )

        new_fitness = evaluate_fitness(best_chrom, config)
        if new_fitness > best_fitness:
            best_fitness = new_fitness
        else:
            # ROLLBACK
            best_chrom[i].day, best_chrom[j].day = best_chrom[j].day, best_chrom[i].day
            best_chrom[i].period, best_chrom[j].period = (
                best_chrom[j].period,
                best_chrom[i].period,
            )

    return best_chrom


def run_memetic_ga(config: Config, verbose: bool = True, progress_callback=None):
    random.seed(config.ga.random_seed)
    ga = config.ga

    population = [create_random_chromosome(config) for _ in range(ga.population_size)]

    best_chromosome = None
    best_fitness = -1
    fitness_history = []
    stagnation_counter = 0
    mutation_rate = ga.mutation_rate

    if verbose:
        print(
            f"\nStarting Memetic GA: {ga.population_size} chromosomes, {ga.max_generations} gens\n"
        )
        print(f"{'Gen':>5}  {'Best':>7}  {'Gen Best':>8}  {'Mutation':>8}  {'Status'}")

    for generation in range(ga.max_generations):
        fitnesses = [evaluate_fitness(chrom, config) for chrom in population]

        gen_best_idx = max(range(len(fitnesses)), key=lambda i: fitnesses[i])
        gen_best_fitness = fitnesses[gen_best_idx]

        if gen_best_fitness > best_fitness:
            best_fitness = gen_best_fitness
            best_chromosome = [g for g in population[gen_best_idx]]
            stagnation_counter = 0
            status = "^ improved"
        else:
            stagnation_counter += 1
            status = ""

        mean_fit = sum(fitnesses) / len(fitnesses)
        worst_fit = min(fitnesses)
        fitness_history.append(
            {"best": best_fitness, "mean": mean_fit, "worst": worst_fit}
        )

        if verbose and (generation % 10 == 0 or gen_best_fitness >= ga.target_fitness):
            print(
                f"{generation:>5}  {best_fitness:>7}  {gen_best_fitness:>8}  {mutation_rate:>8.3f}  {status}"
            )

        if progress_callback and generation % 10 == 0:
            progress_callback(generation, ga.max_generations, best_fitness)

        if best_fitness >= ga.target_fitness and generation > 0:
            if verbose:
                print(
                    f"\n[✓] Target fitness {ga.target_fitness} reached at generation {generation}!"
                )
            break

        if stagnation_counter >= ga.stagnation_window:
            mutation_rate = ga.stagnation_mutation_boost
            if verbose and stagnation_counter == ga.stagnation_window:
                print(
                    f"  [!] Stagnation at gen {generation} -> mutation boosted to {mutation_rate}"
                )
        else:
            mutation_rate = ga.mutation_rate

        # MEMETIC LOCAL SEARCH
        if generation > 0 and generation % 20 == 0:
            if verbose:
                print(f"  [*] Running Hill Climb on best chromosome...")
            improved_chrom = hill_climb(best_chromosome, config, steps=50)
            improved_fit = evaluate_fitness(improved_chrom, config)
            if improved_fit > best_fitness:
                best_fitness = improved_fit
                best_chromosome = [g for g in improved_chrom]
                status = "^ HC improved"
                fitness_history[-1]["best"] = best_fitness
                if verbose:
                    print(f"  [^] HC improved fitness to {best_fitness}")

        sorted_indices = sorted(
            range(len(fitnesses)), key=lambda i: fitnesses[i], reverse=True
        )
        next_population = []

        next_population.append([g for g in best_chromosome])

        for i in range(1, ga.elitism_count):
            next_population.append(population[sorted_indices[i]])

        while len(next_population) < ga.population_size:
            parent_a = tournament_select(population, fitnesses, ga.tournament_size)
            parent_b = tournament_select(population, fitnesses, ga.tournament_size)

            if random.random() < ga.crossover_rate:
                child = day_block_crossover(parent_a, parent_b, config)
            else:
                child = list(parent_a)

            child = mutate(child, mutation_rate, config)
            next_population.append(child)

        population = next_population

    if verbose:
        print("-" * 55)
        print(f"Final best fitness: {best_fitness} / {MAX_SCORE}\n")

    return best_chromosome, fitness_history


def run_island_ga(config: Config, verbose: bool = True, progress_callback=None):
    num_islands = 4
    island_size = max(10, config.ga.population_size // num_islands)

    islands = []
    base_seed = config.ga.random_seed

    for i in range(num_islands):
        random.seed(base_seed + i)
        pop = [create_random_chromosome(config) for _ in range(island_size)]
        islands.append(pop)

    random.seed(base_seed)  

    ga = config.ga

    best_chromosome = None
    best_fitness = -1
    fitness_history = []

    if verbose:
        print(
            f"\nStarting Island MT GA: {num_islands} islands of size {island_size}, {ga.max_generations} gens\n"
        )
        print(f"{'Gen':>5}  {'Best':>7}  {'Gen Best':>8}  {'Status'}")

    for generation in range(ga.max_generations):

        gen_best_fitness = -1
        gen_best_chrom = None

        island_fitnesses = []
        for i in range(num_islands):
            fitnesses = [evaluate_fitness(chrom, config) for chrom in islands[i]]
            island_fitnesses.append(fitnesses)

            ibest_idx = max(range(len(fitnesses)), key=lambda idx: fitnesses[idx])
            ibest_fit = fitnesses[ibest_idx]

            if ibest_fit > gen_best_fitness:
                gen_best_fitness = ibest_fit
                gen_best_chrom = islands[i][ibest_idx]

        status = ""
        if gen_best_fitness > best_fitness:
            best_fitness = gen_best_fitness
            best_chromosome = [g for g in gen_best_chrom]
            status = "^ improved"

        mean_fit = sum(fitnesses) / len(fitnesses)
        worst_fit = min(fitnesses)
        fitness_history.append(
            {"best": best_fitness, "mean": mean_fit, "worst": worst_fit}
        )

        if verbose and (generation % 10 == 0 or gen_best_fitness >= ga.target_fitness):
            print(
                f"{generation:>5}  {best_fitness:>7}  {gen_best_fitness:>8}  {status}"
            )

        if progress_callback and generation % 10 == 0:
            progress_callback(generation, ga.max_generations, best_fitness)

        if best_fitness >= ga.target_fitness:
            if generation == 0:
                if verbose:
                    print(
                        f"\n[!] Target {ga.target_fitness} reached at Gen 0! Raising to MAX_SCORE ({MAX_SCORE}) to force soft-constraint optimization."
                    )
                ga.target_fitness = MAX_SCORE
            else:
                if verbose:
                    print(
                        f"\n[✓] Target fitness {ga.target_fitness} reached at gen {generation}!"
                    )
                break

        # Migration
        if generation > 0 and generation % 50 == 0:
            if verbose:
                print(f"  [~] Migration between islands at gen {generation}...")
            # Extract best 2 from each island
            migrants = []
            for i in range(num_islands):
                fits = island_fitnesses[i]
                sorted_idx = sorted(
                    range(len(fits)), key=lambda idx: fits[idx], reverse=True
                )
                migrants.append(
                    [
                        [g for g in islands[i][sorted_idx[0]]],
                        [g for g in islands[i][sorted_idx[1]]],
                    ]
                )

            # Ring topology substitution (replace worst 2 with neighbor's best 2)
            for i in range(num_islands):
                source_idx = (i - 1) % num_islands
                # The worst 2 of island i gets replaced by migrants from source_idx
                fits = island_fitnesses[i]
                sorted_idx = sorted(
                    range(len(fits)), key=lambda idx: fits[idx]
                )  
                islands[i][sorted_idx[0]] = migrants[source_idx][0]
                islands[i][sorted_idx[1]] = migrants[source_idx][1]

        for i in range(num_islands):
            fits = island_fitnesses[i]
            sorted_idx = sorted(
                range(len(fits)), key=lambda idx: fits[idx], reverse=True
            )

            next_pop = []
            # Elitism per island
            for e in range(ga.elitism_count):
                if e < len(sorted_idx):
                    next_pop.append(islands[i][sorted_idx[e]])

            while len(next_pop) < island_size:
                p_a = tournament_select(islands[i], fits, ga.tournament_size)
                p_b = tournament_select(islands[i], fits, ga.tournament_size)
                if random.random() < ga.crossover_rate:
                    child = day_block_crossover(p_a, p_b, config)
                else:
                    child = list(p_a)
                child = mutate(child, ga.mutation_rate, config)
                next_pop.append(child)

            islands[i] = next_pop

    if verbose:
        print(f"Final best fitness: {best_fitness} / {MAX_SCORE}\n")

    return best_chromosome, fitness_history


def roulette_select(scores):
    total = sum(scores)
    r = random.uniform(0, total)
    upto = 0
    for i, w in enumerate(scores):
        if upto + w >= r:
            return i
        upto += w
    return len(scores) - 1


def run_hyper_heuristic_ga(config: Config, verbose: bool = True, progress_callback=None):
    from src.operators import mutate_day_move, mutate_room_reassign, mutate_slot_swap

    random.seed(config.ga.random_seed)
    ga = config.ga

    population = [create_random_chromosome(config) for _ in range(ga.population_size)]

    best_chromosome = None
    best_fitness = -1
    fitness_history = []
    stagnation_counter = 0
    mutation_rate = ga.mutation_rate

    operators = [mutate_slot_swap, mutate_room_reassign, mutate_day_move]
    operator_scores = [1.0, 1.0, 1.0]

    if verbose:
        print(
            f"\nStarting Hyper-heuristic GA: {ga.population_size} chromosomes, {ga.max_generations} gens\n"
        )
        print(
            f"{'Gen':>5}  {'Best':>7}  {'Gen Best':>8}  {'Scores (S,R,D)'}     {'Status'}"
        )

    for generation in range(ga.max_generations):
        fitnesses = [evaluate_fitness(chrom, config) for chrom in population]

        gen_best_idx = max(range(len(fitnesses)), key=lambda i: fitnesses[i])
        gen_best_fitness = fitnesses[gen_best_idx]

        if gen_best_fitness > best_fitness:
            best_fitness = gen_best_fitness
            best_chromosome = [g for g in population[gen_best_idx]]
            stagnation_counter = 0
            status = "^ improved"
        else:
            stagnation_counter += 1
            status = ""

        mean_fit = sum(fitnesses) / len(fitnesses)
        worst_fit = min(fitnesses)
        fitness_history.append(
            {"best": best_fitness, "mean": mean_fit, "worst": worst_fit}
        )

        if verbose and (generation % 10 == 0 or gen_best_fitness >= ga.target_fitness):
            scores_str = f"[{operator_scores[0]:.1f}, {operator_scores[1]:.1f}, {operator_scores[2]:.1f}]"
            print(
                f"{generation:>5}  {best_fitness:>7}  {gen_best_fitness:>8}  {scores_str:^16}  {status}"
            )

        if progress_callback and generation % 10 == 0:
            progress_callback(generation, ga.max_generations, best_fitness)

        if best_fitness >= ga.target_fitness:
            if generation == 0:
                if verbose:
                    print(
                        f"\n[!] Target {ga.target_fitness} reached at Gen 0! Raising to MAX_SCORE ({MAX_SCORE}) to force soft-constraint optimization."
                    )
                ga.target_fitness = MAX_SCORE
            else:
                if verbose:
                    print(
                        f"\n[✓] Target fitness {ga.target_fitness} reached at gen {generation}!"
                    )
                break

        if stagnation_counter >= ga.stagnation_window:
            mutation_rate = ga.stagnation_mutation_boost
            if verbose and stagnation_counter == ga.stagnation_window:
                print(
                    f"  [!] Stagnation at gen {generation} -> mutation boosted to {mutation_rate}"
                )
        else:
            mutation_rate = ga.mutation_rate

        sorted_indices = sorted(
            range(len(fitnesses)), key=lambda i: fitnesses[i], reverse=True
        )
        next_population = []

        for i in range(ga.elitism_count):
            next_population.append(population[sorted_indices[i]])

        while len(next_population) < ga.population_size:
            parent_a = tournament_select(population, fitnesses, ga.tournament_size)
            parent_b = tournament_select(population, fitnesses, ga.tournament_size)

            if random.random() < ga.crossover_rate:
                child = day_block_crossover(parent_a, parent_b, config)
            else:
                child = list(parent_a)

            # Hyper-Heuristic Mutation
            op_idx = roulette_select(operator_scores)
            op_func = operators[op_idx]

            old_fit = evaluate_fitness(child, config)
            new_child = op_func(child, mutation_rate, config)
            new_fit = evaluate_fitness(new_child, config)

            if new_fit > old_fit:
                operator_scores[op_idx] += 1.0
            else:
                operator_scores[op_idx] -= 0.1

            operator_scores[op_idx] = max(
                0.1, operator_scores[op_idx]
            )  

            next_population.append(new_child)

        operator_scores = [max(0.1, s * 0.95) for s in operator_scores]

        population = next_population

    if verbose:
        print(f"Final best fitness: {best_fitness} / {MAX_SCORE}\n")

    return best_chromosome, fitness_history


from src.fitness import get_penalty_breakdown


def evaluate_nsga2_objectives(chromosome, config: Config):
    bd = get_penalty_breakdown(chromosome, config)
    hard = sum(bd["hard_penalties"].values())
    soft = sum(bd["soft_penalties"].values())
    return hard, soft


def dominates(obj_a, obj_b):
    return (obj_a[0] <= obj_b[0] and obj_a[1] <= obj_b[1]) and (
        obj_a[0] < obj_b[0] or obj_a[1] < obj_b[1]
    )


def fast_non_dominated_sort(objectives_list):
    fronts = [[]]
    S = [[] for _ in range(len(objectives_list))]
    n = [0] * len(objectives_list)

    for p in range(len(objectives_list)):
        for q in range(len(objectives_list)):
            if p == q:
                continue
            if dominates(objectives_list[p], objectives_list[q]):
                S[p].append(q)
            elif dominates(objectives_list[q], objectives_list[p]):
                n[p] += 1
        if n[p] == 0:
            fronts[0].append(p)

    i = 0
    while len(fronts[i]) > 0:
        next_front = []
        for p in fronts[i]:
            for q in S[p]:
                n[q] -= 1
                if n[q] == 0:
                    next_front.append(q)
        i += 1
        if next_front:
            fronts.append(next_front)
        else:
            break

    return fronts


def crowding_distance_assignment(front, objectives_list):
    l = len(front)
    distances = {i: 0.0 for i in front}
    if l == 0:
        return distances
    if l <= 2:
        for i in front:
            distances[i] = float("inf")
        return distances

    num_obj = len(objectives_list[0])
    for m in range(num_obj):
        front_sorted = sorted(front, key=lambda idx: objectives_list[idx][m])
        distances[front_sorted[0]] = float("inf")
        distances[front_sorted[-1]] = float("inf")

        obj_min = objectives_list[front_sorted[0]][m]
        obj_max = objectives_list[front_sorted[-1]][m]

        if obj_max - obj_min == 0:
            continue

        for i in range(1, l - 1):
            distances[front_sorted[i]] += (
                objectives_list[front_sorted[i + 1]][m]
                - objectives_list[front_sorted[i - 1]][m]
            ) / (obj_max - obj_min)

    return distances


def nsga2_tournament_select(population, ranks, distances, k=5):
    contestants = random.sample(range(len(population)), k)

    def key_func(idx):
        return (-ranks[idx], distances[idx])

    best_idx = max(contestants, key=key_func)
    return population[best_idx]


def run_nsga2(config: Config, verbose: bool = True, progress_callback=None):
    random.seed(config.ga.random_seed)
    ga = config.ga

    population = [create_random_chromosome(config) for _ in range(ga.population_size)]

    if verbose:
        print(
            f"\nStarting NSGA-II: {ga.population_size} chromosomes, {ga.max_generations} gens\n"
        )
        print(f"{'Gen':>5}  {'Front 0 Size':>12}  {'Best Hard':>10}  {'Best Soft':>10}")

    fitness_history = []

    for generation in range(ga.max_generations):
        objectives = [evaluate_nsga2_objectives(chrom, config) for chrom in population]
        fronts = fast_non_dominated_sort(objectives)

        best_hard = min([objectives[i][0] for i in fronts[0]])
        best_soft = min([objectives[i][1] for i in fronts[0]])

        if verbose and (generation % 10 == 0 or generation == ga.max_generations - 1):
            print(
                f"{generation:>5}  {len(fronts[0]):>12}  {best_hard:>10}  {best_soft:>10}"
            )
            
        proxy_fitnesses = [MAX_SCORE - (o[0] * config.ga.hard_penalty_weight) - (o[1] * config.ga.soft_penalty_weight) for o in objectives]
        best_fit = max(proxy_fitnesses)
        mean_fit = sum(proxy_fitnesses) / len(proxy_fitnesses)
        worst_fit = min(proxy_fitnesses)
        fitness_history.append({"best": best_fit, "mean": mean_fit, "worst": worst_fit})

        if progress_callback and generation % 10 == 0:
            progress_callback(generation, ga.max_generations, best_fit)

        ranks = {}
        for rank, front in enumerate(fronts):
            for idx in front:
                ranks[idx] = rank

        distances = {}
        for front in fronts:
            dist = crowding_distance_assignment(front, objectives)
            distances.update(dist)

        offspring = []
        while len(offspring) < ga.population_size:
            parent_a = nsga2_tournament_select(
                population, ranks, distances, ga.tournament_size
            )
            parent_b = nsga2_tournament_select(
                population, ranks, distances, ga.tournament_size
            )

            if random.random() < ga.crossover_rate:
                child = day_block_crossover(parent_a, parent_b, config)
            else:
                child = list(parent_a)

            child = mutate(child, ga.mutation_rate, config)
            offspring.append(child)

        combined_population = population + offspring
        combined_objectives = [
            evaluate_nsga2_objectives(c, config) for c in combined_population
        ]
        combined_fronts = fast_non_dominated_sort(combined_objectives)

        new_population = []
        for front in combined_fronts:
            if len(new_population) + len(front) <= ga.population_size:
                for idx in front:
                    new_population.append(combined_population[idx])
            else:
                dist = crowding_distance_assignment(front, combined_objectives)
                front_sorted = sorted(front, key=lambda idx: dist[idx], reverse=True)
                needed = ga.population_size - len(new_population)
                for idx in front_sorted[:needed]:
                    new_population.append(combined_population[idx])
                break

        population = new_population

    if verbose:
        pass

    final_objs = [evaluate_nsga2_objectives(chrom, config) for chrom in population]
    final_fronts = fast_non_dominated_sort(final_objs)
    pareto_front = [population[i] for i in final_fronts[0]]
    pareto_objs = [final_objs[i] for i in final_fronts[0]]

    return pareto_front, pareto_objs, fitness_history