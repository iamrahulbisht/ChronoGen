export interface TeacherResponse {
  id: string; institution_id: string; teacher_code: string; name: string;
  teaches_subjects: string[]; max_lectures_per_week: number;
  max_consecutive_lectures: number; unavailable_periods: [number, number][];
  prefers_morning: boolean; created_at: string; updated_at: string | null;
}
