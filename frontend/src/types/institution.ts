export interface InstitutionResponse {
  id: string; name: string; days_per_week: number; periods_per_day: number;
  period_duration_minutes: number; lunch_break_after_period: number;
  created_at: string; updated_at: string | null;
}
export interface RoomResponse {
  id: string; institution_id: string; room_code: string; name: string;
  capacity: number; type: string; created_at: string;
}
