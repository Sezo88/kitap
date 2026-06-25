export type Role = "super_admin" | "idareci" | "ogretmen";

export type BookStatus = "active" | "completed" | "abandoned";

export interface School {
  id: string;
  name: string;
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
