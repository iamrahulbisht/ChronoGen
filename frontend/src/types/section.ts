export interface CurriculumEntry {
  subject_id: string; teacher_id: string; min_per_week: number;
}
export interface SectionResponse {
  id: string; institution_id: string; section_code: string; name: string;
  student_count: number; fixed_classroom: string | null; fixed_lab: string | null;
  curriculum: CurriculumEntry[]; created_at: string; updated_at: string | null;
}
