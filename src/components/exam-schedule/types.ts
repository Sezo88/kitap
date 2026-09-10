import type { ExamPeriod, ExamSchedule, ExamScheduleWithDetails, Subject } from "@/lib/types/database";

export interface ExamScheduleProps {
  initialPeriods: ExamPeriod[];
  initialSchedules: ExamScheduleWithDetails[];
  subjects: Subject[];
  gradeLevels: number[];
  schoolName: string;
  role: "super_admin" | "idareci" | "ogretmen";
  userId: string;
  schoolId: string;
}

export interface DayExamSummary {
  date: string;
  dayName: string;
  formattedDate: string;
  isAllowed: boolean;
  examsByGrade: Record<number, ExamScheduleWithDetails[]>;
}

export const SUBJECT_COLOR_PALETTES: Record<string, {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  printBg: string;
  printBorder: string;
  printText: string;
  accent: string;
}> = {
  turkce: {
    badgeBg: "bg-rose-50 dark:bg-rose-950/70",
    badgeBorder: "border-rose-200 dark:border-rose-700",
    badgeText: "text-rose-900 dark:text-rose-100",
    printBg: "#fff1f2",
    printBorder: "#fecdd3",
    printText: "#be123c",
    accent: "rose",
  },
  matematik: {
    badgeBg: "bg-blue-50 dark:bg-blue-950/70",
    badgeBorder: "border-blue-200 dark:border-blue-700",
    badgeText: "text-blue-900 dark:text-blue-100",
    printBg: "#eff6ff",
    printBorder: "#bfdbfe",
    printText: "#1d4ed8",
    accent: "blue",
  },
  fen: {
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/70",
    badgeBorder: "border-emerald-200 dark:border-emerald-700",
    badgeText: "text-emerald-900 dark:text-emerald-100",
    printBg: "#ecfdf5",
    printBorder: "#a7f3d0",
    printText: "#047857",
    accent: "emerald",
  },
  sosyal: {
    badgeBg: "bg-amber-50 dark:bg-amber-950/70",
    badgeBorder: "border-amber-200 dark:border-amber-700",
    badgeText: "text-amber-900 dark:text-amber-100",
    printBg: "#fffbeb",
    printBorder: "#fde68a",
    printText: "#b45309",
    accent: "amber",
  },
  ingilizce: {
    badgeBg: "bg-purple-50 dark:bg-purple-950/70",
    badgeBorder: "border-purple-200 dark:border-purple-700",
    badgeText: "text-purple-900 dark:text-purple-100",
    printBg: "#faf5ff",
    printBorder: "#e9d5ff",
    printText: "#7e22ce",
    accent: "purple",
  },
  din: {
    badgeBg: "bg-teal-50 dark:bg-teal-950/70",
    badgeBorder: "border-teal-200 dark:border-teal-700",
    badgeText: "text-teal-900 dark:text-teal-100",
    printBg: "#f0fdfa",
    printBorder: "#99f6e4",
    printText: "#0f766e",
    accent: "teal",
  },
  default: {
    badgeBg: "bg-indigo-50 dark:bg-indigo-950/70",
    badgeBorder: "border-indigo-200 dark:border-indigo-700",
    badgeText: "text-indigo-900 dark:text-indigo-100",
    printBg: "#eef2ff",
    printBorder: "#c7d2fe",
    printText: "#4338ca",
    accent: "indigo",
  },
};

export function getSubjectTheme(subjectName: string = "") {
  const lower = subjectName.toLocaleLowerCase("tr-TR");
  if (lower.includes("türk") || lower.includes("edeb")) return SUBJECT_COLOR_PALETTES.turkce;
  if (lower.includes("mat")) return SUBJECT_COLOR_PALETTES.matematik;
  if (lower.includes("fen") || lower.includes("fizik") || lower.includes("kimya") || lower.includes("biyo")) return SUBJECT_COLOR_PALETTES.fen;
  if (lower.includes("sosyal") || lower.includes("tarih") || lower.includes("inkılap") || lower.includes("coğ")) return SUBJECT_COLOR_PALETTES.sosyal;
  if (lower.includes("ingiliz") || lower.includes("yabancı") || lower.includes("almanca")) return SUBJECT_COLOR_PALETTES.ingilizce;
  if (lower.includes("din") || lower.includes("ahlak") || lower.includes("peygam")) return SUBJECT_COLOR_PALETTES.din;
  return SUBJECT_COLOR_PALETTES.default;
}

export function formatTurkishDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDayName(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("tr-TR", { weekday: "long" });
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/**
 * Başlangıç ve bitiş tarihi arasındaki hafta içi günleri döner (YYYY-MM-DD)
 */
export function generateBusinessDays(startStr: string, endStr: string): string[] {
  if (!startStr || !endStr) return [];
  const dates: string[] = [];
  const [sY, sM, sD] = startStr.split("-").map(Number);
  const [eY, eM, eD] = endStr.split("-").map(Number);
  
  const current = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
