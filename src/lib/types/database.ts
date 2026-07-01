export type Role = "super_admin" | "idareci" | "ogretmen";

export type BookStatus = "active" | "completed" | "abandoned";

export interface School {
  id: string;
  name: string;
  total_lessons: number;
  created_by: string;
  created_at: string;
}

export interface Profile {
  id: string;
  school_id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  grade_level: number;
  created_at: string;
}

export interface TeacherClass {
  id: string;
  teacher_id: string;
  class_id: string;
}

export interface Student {
  id: string;
  school_id: string;
  class_id: string;
  e_okul_no: string | null;
  full_name: string;
  is_active: boolean;
  veli_telefon: string | null;
  veli_telefon_2: string | null;
  created_at: string;
}

export interface Book {
  id: string;
  school_id: string;
  title: string;
  author: string;
  page_count: number | null;
  category: string | null;
  added_by: string;
  created_at: string;
}

export interface StudentBook {
  id: string;
  student_id: string;
  book_id: string;
  status: BookStatus;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface ReadingLog {
  id: string;
  student_id: string;
  class_id: string;
  log_date: string;
  brought_book: boolean;
  did_read: boolean;
  active_book_id: string | null;
  marked_by: string;
  note: string | null;
  created_at: string;
}

// Composite types for views/joins
export interface StudentWithClass extends Student {
  classes?: { name: string } | { name: string }[] | null;
  active_book_title?: string | null;
}

// Helper to extract class name from Supabase join result
export function getClassName(student: StudentWithClass): string {
  if (!student.classes) return "";
  if (Array.isArray(student.classes)) {
    return student.classes[0]?.name || "";
  }
  return student.classes.name || "";
}

export interface ReadingLogWithStudent extends ReadingLog {
  student_name: string;
  active_book_title?: string | null;
}

export interface ReportRow {
  student_id: string;
  student_name: string;
  class_name: string;
  total_days: number;
  read_days: number;
  brought_days: number;
  read_rate: number;
  brought_rate: number;
}

// ── Yoklama + SMS Tipleri ─────────────────────────────────────

export type AttendanceStatus = "absent" | "present" | "corrected_present";
export type AttendanceReason = "bilinmiyor" | "veli_bilgi_verdi" | "raporlu_izinli";
export type SmsMessageType = "absence_alert" | "correction_alert" | "test";
export type SmsStatus = "pending" | "sent" | "failed";
export type SmsProviderName = "netgsm" | "iletim_merkezi" | "vatan_sms" | "custom";

export interface AttendanceLog {
  id: string;
  student_id: string;
  class_id: string;
  log_date: string;
  lesson_no: number;
  status: AttendanceStatus;
  reason: AttendanceReason | null;
  marked_by: string;
  corrected_at: string | null;
  corrected_by: string | null;
  created_at: string;
}

export interface SmsLog {
  id: string;
  attendance_log_id: string | null;
  student_id: string;
  phone_number: string;
  message_type: SmsMessageType;
  message_body: string;
  status: SmsStatus;
  provider_response: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
}

export interface SmsProviderSettings {
  id: string;
  school_id: string;
  provider_name: SmsProviderName;
  api_base_url: string | null;
  api_key: string;
  api_secret: string | null;
  sender_id: string;
  http_method: "GET" | "POST";
  header_template: Record<string, string> | null;
  body_template: string | null;
  is_active: boolean;
  sms_unit_cost: number | null;
  last_tested_at: string | null;
  last_test_result: string | null;
  updated_by: string;
  updated_at: string;
}

export interface AttendanceLogWithStudent extends AttendanceLog {
  students?: {
    full_name: string;
    veli_telefon: string | null;
    veli_telefon_2: string | null;
    classes?: { name: string } | null;
  } | null;
}

export interface CleanlinessCriteria {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
}

export interface CleanlinessScore {
  id: string;
  class_id: string;
  criteria_id: string;
  score_date: string;
  score: number;
  marked_by: string | null;
  created_at: string;
}

// ── Proje / Ders Tipleri ─────────────────────────────────────

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
}

export interface StudentProject {
  id: string;
  student_id: string;
  subject_id: string;
  class_id: string;
  assigned_by: string;
  created_at: string;
}

export interface StudentProjectWithDetails extends StudentProject {
  students?: { full_name: string; e_okul_no: string | null } | null;
  subjects?: { name: string } | null;
  classes?: { name: string } | null;
}

