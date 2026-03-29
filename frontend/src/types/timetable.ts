export interface SlotInfo {
  subject: string; teacher: string | null; room: string | null; is_lab: boolean;
}
export type ClassTimetable = Record<string, Record<string, Record<string, SlotInfo>>>
export interface TimetableResponse {
  job_id: string; timetable: ClassTimetable;
  teacher_timetable: Record<string, Record<string, Record<string, { class: string; subject: string; room: string }>>>;
  room_timetable: Record<string, Record<string, Record<string, { class: string; subject: string; teacher: string }>>>;
}
