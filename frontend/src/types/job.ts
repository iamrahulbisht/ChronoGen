export interface GAConfigSchema {
  population_size: number; max_generations: number; crossover_rate: number;
  mutation_rate: number; tournament_size: number; elitism_count: number;
  stagnation_window: number; stagnation_mutation_boost: number;
  target_fitness: number; random_seed: number;
  hard_penalty_weight: number; soft_penalty_weight: number;
}
export interface ConstraintBreakdown {
  H1_teacher_clash: number; H2_class_clash: number; H3_room_clash: number;
  H_LAB1_odd_period: number; H_LAB2_next_free: number;
  S1_missing_lectures: number; S2_teacher_overload: number;
  S3_consecutive: number; S4_same_subj_day: number;
  S5_class_gaps: number; S6_teacher_gaps: number;
  S8_morning_pref: number; S9_late_period: number; S10_room_spread: number;
}
export interface JobResult {
  fitness_score: number | null; total_penalty: number | null;
  generations_run: number | null;
  constraint_breakdown: ConstraintBreakdown | null;
  fitness_history: { best: number; mean: number; worst: number }[] | null;
  chromosome: object[] | null; pareto_front: object[] | null;
}
export interface JobProgress {
  current_generation: number;
  max_generations: number;
  best_fitness: number;
}
export interface JobResponse {
  job_id: string; institution_id: string; algorithm: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  ga_config: GAConfigSchema; result: JobResult | null;
  progress?: JobProgress;
  export_paths: Record<string, unknown> | null;
  error_message: string | null; started_at: string | null;
  completed_at: string | null; created_at: string;
}
export interface JobListResponse {
  job_id: string; institution_id: string; algorithm: string;
  status: string; created_at: string; completed_at: string | null;
}
