export interface SubjectResponse {
  id: string; institution_id: string; subject_code: string; name: string;
  requires_room_type: string; min_lectures_per_week: number;
  is_lab: boolean; is_split_allowed: boolean;
  created_at: string; updated_at: string | null;
}
