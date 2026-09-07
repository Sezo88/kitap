import * as XLSX from "xlsx";

export interface ParsedLessonSlot {
  teacherName: string;
  className: string;
  day: number; // 1: Pazartesi, ..., 5: Cuma
  period: number; // 1, 2, ...
  shortCode: string;
  subjectFullName: string;
}

export interface ParsedTeacherDuty {
  teacherName: string;
  day: number; // 1..5
  location: string;
}

export interface TeacherElProgramiParseResult {
  lessons: ParsedLessonSlot[];
  duties: ParsedTeacherDuty[];
  teachers: string[];
  classes: string[];
  subjects: { code: string; fullName: string }[];
  maxPeriod: number;
}

const DAYS_MAP: Record<string, number> = {
  pazartesi: 1,
  sali: 2,
  salı: 2,
  carsamba: 3,
  çarşamba: 3,
  persembe: 4,
  perşembe: 4,
  cuma: 5,
};

const DEFAULT_CODE_MAP: Record<string, string> = {
  "5-KMYV": "Kültür ve Medeniyetimize Yön Verenler (5)",
  "5-OYUN": "Oyun ve Oyun Etkinlikleri (5)",
  "6-GKVN": "Görgü Kuralları ve Nezaket (6)",
  "8-KMYV": "Kültür ve Medeniyetimize Yön Verenler (8)",
  AHLAK: "Ahlak ve Vatandaşlık Eğitimi",
  BED: "Beden Eğitimi ve Spor",
  BIL: "Bilişim Teknolojileri ve Yazılım",
  DIN: "Din Kültürü ve Ahlak Bilgisi",
  FEN: "Fen Bilimleri",
  GÖR: "Görsel Sanatlar",
  ING: "İngilizce",
  INGI: "İngilizce",
  MAT: "Matematik",
  MBİLM6: "Matematik ve Bilim Uygulamaları (6)",
  MEDYA: "Medya Okuryazarlığı",
  MÜZ: "Müzik",
  PROJE: "Proje Tasarımı ve Uygulamaları",
  REH: "Rehberlik ve Yönlendirme",
  "REH.": "Rehberlik ve Yönlendirme",
  SOSBIL: "Sosyal Bilgiler",
  TEK: "Teknoloji ve Tasarım",
  TUR: "Türkçe",
  TÜR: "Türkçe",
  "YAZ-MATB": "Yazarlık Becerileri",
  "Ö H BD": "Özel Eğitim Beden Eğitimi",
  ÖHM: "Özel Eğitim Müzik",
  ÖHR: "Özel Eğitim Görsel Sanatlar",
  ÖOBED: "Özel Eğitim Beden Eğitimi",
  ÖOMÜZ: "Özel Eğitim Müzik",
  ÖORES: "Özel Eğitim Görsel Sanatlar",
  İNK: "T.C. İnkılap Tarihi ve Atatürkçülük",
};

/**
 * Parses OgretmenElProgrami.xls buffer into structured lesson schedules and duties.
 */
export function parseOgretmenElProgrami(buffer: ArrayBuffer | Uint8Array): TeacherElProgramiParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel dosyasında sayfa bulunamadı.");
  }
  const sheet = wb.Sheets[sheetName];
  const data: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let currentTeacher: string | null = null;
  let inSubjectTable = false;

  // teacher -> class -> string[] (full subject names from bottom table)
  const teacherClassSubject: Record<string, Record<string, string[]>> = {};
  const duties: ParsedTeacherDuty[] = [];

  // 1. Pass: Collect subject names from bottom tables and duties
  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    const first = String(row[0] || "").trim();

    if (first.startsWith("Sayın :") || first.startsWith("Sayın:")) {
      currentTeacher = first.replace(/^Sayın\s*:\s*/i, "").trim();
      inSubjectTable = false;
      continue;
    }

    // Check duty row
    if (currentTeacher && (first.startsWith("Nöbet Günü ve Yeri :") || first.startsWith("Nöbet Günü ve Yeri:"))) {
      const dutyRaw = first.replace(/^Nöbet Günü ve Yeri\s*:\s*/i, "").trim();
      if (dutyRaw) {
        // e.g. "Tam Gün : Perşembe!ARKA BAHÇE" or multiple "Tam Gün : Pazartesi!ZEMİN KAT?Tam Gün : Salı!1. KAT"
        const parts = dutyRaw.split("?").map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          // "Tam Gün : Perşembe!ARKA BAHÇE"
          const exclamationParts = part.split("!");
          const dayPart = (exclamationParts[0] || "").replace(/^Tam Gün\s*:\s*/i, "").trim().toLowerCase();
          const location = (exclamationParts[1] || "").trim();
          const dayNo = DAYS_MAP[dayPart];
          if (dayNo && location) {
            duties.push({
              teacherName: currentTeacher,
              day: dayNo,
              location,
            });
          }
        }
      }
      continue;
    }

    if (first === "Sınıf" && (String(row[2] || "").trim() === "Dersin Adı" || String(row[1] || "").trim() === "Dersin Adı")) {
      inSubjectTable = true;
      continue;
    }

    if (inSubjectTable) {
      if (first.startsWith("T.C.") || first.startsWith("Sayın") || first.startsWith("Toplam")) {
        inSubjectTable = false;
      } else if (first && row[1]) {
        const className = first;
        const sName = String(row[1]).trim();
        if (sName && sName !== "Dersin Adı" && !sName.startsWith("202")) {
          if (!teacherClassSubject[currentTeacher || ""]) {
            teacherClassSubject[currentTeacher || ""] = {};
          }
          if (!teacherClassSubject[currentTeacher || ""][className]) {
            teacherClassSubject[currentTeacher || ""][className] = [];
          }
          if (!teacherClassSubject[currentTeacher || ""][className].includes(sName)) {
            teacherClassSubject[currentTeacher || ""][className].push(sName);
          }
        }
      }
    }
  }

  // 2. Pass: Extract grid lessons
  const lessons: ParsedLessonSlot[] = [];
  currentTeacher = null;
  let maxPeriodFound = 7;

  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    const first = String(row[0] || "").trim();
    const firstLower = first.toLowerCase();

    if (first.startsWith("Sayın :") || first.startsWith("Sayın:")) {
      currentTeacher = first.replace(/^Sayın\s*:\s*/i, "").trim();
      continue;
    }

    if (currentTeacher && DAYS_MAP[firstLower]) {
      const day = DAYS_MAP[firstLower];
      for (let col = 1; col <= 12; col++) {
        const cell = row[col];
        if (cell !== null && cell !== undefined && typeof cell === "string" && cell.trim()) {
          const parts = cell
            .trim()
            .split("\n")
            .map((p) => p.trim())
            .filter(Boolean);

          if (parts.length > 0) {
            const className = parts[0];
            const shortCode = parts.slice(1).join(" ") || className;

            // Determine best full name:
            // 1. If DEFAULT_CODE_MAP has canonical name, prioritize it to unify casing
            const possibleNames = (teacherClassSubject[currentTeacher] && teacherClassSubject[currentTeacher][className]) || [];
            let subjectFullName = "";
            if (DEFAULT_CODE_MAP[shortCode]) {
              subjectFullName = DEFAULT_CODE_MAP[shortCode];
            } else if (possibleNames.length > 0) {
              subjectFullName = possibleNames[0];
            } else {
              subjectFullName = shortCode;
            }

            lessons.push({
              teacherName: currentTeacher,
              className,
              day,
              period: col,
              shortCode,
              subjectFullName,
            });

            if (col > maxPeriodFound) {
              maxPeriodFound = col;
            }
          }
        }
      }
    }
  }

  const teacherSet = new Set<string>();
  const classSet = new Set<string>();
  const subjectMap = new Map<string, string>(); // code -> fullName

  for (const l of lessons) {
    teacherSet.add(l.teacherName);
    classSet.add(l.className);
    if (!subjectMap.has(l.shortCode)) {
      subjectMap.set(l.shortCode, l.subjectFullName);
    }
  }

  return {
    lessons,
    duties,
    teachers: Array.from(teacherSet).sort(),
    classes: Array.from(classSet).sort(),
    subjects: Array.from(subjectMap.entries()).map(([code, fullName]) => ({ code, fullName })),
    maxPeriod: maxPeriodFound,
  };
}
