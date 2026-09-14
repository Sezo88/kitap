import * as XLSX from "xlsx";

export interface ParsedDutyEntry {
  day_of_week: number;
  location: string;
  teacher_name: string;
}

export interface ParseDutyScheduleResult {
  places: string[];
  entries: ParsedDutyEntry[];
  summary: {
    totalAssignments: number;
    distinctTeachers: number;
    teacherDutyCounts: { teacher_name: string; count: number; extra_duties: number }[];
  };
}

const DAYS = [
  { num: 1, name: "pazartesi" },
  { num: 2, name: "salı", alt: "sali" },
  { num: 3, name: "çarşamba", alt: "carsamba" },
  { num: 4, name: "perşembe", alt: "persembe" },
  { num: 5, name: "cuma" },
];

export function parseDutyScheduleExcel(data: ArrayBuffer | Uint8Array): ParseDutyScheduleResult {
  const workbook = XLSX.read(data, { type: "array" });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel dosyasında geçerli bir sayfa bulunamadı.");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

  if (!rows || rows.length === 0) {
    throw new Error("Excel sayfası boş.");
  }

  // 1. Gün başlıklarını ara (Pazartesi, Salı, Çarşamba...)
  let headerRowIdx = -1;
  const dayColMap: Record<number, number> = {};

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    let matchCount = 0;
    const tempMap: Record<number, number> = {};

    row.forEach((cell, colIdx) => {
      const cellStr = String(cell).toLowerCase().trim();
      DAYS.forEach((day) => {
        if (cellStr.includes(day.name) || (day.alt && cellStr.includes(day.alt))) {
          if (tempMap[day.num] === undefined) {
            tempMap[day.num] = colIdx;
            matchCount++;
          }
        }
      });
    });

    if (matchCount >= 3) {
      headerRowIdx = r;
      Object.assign(dayColMap, tempMap);
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error("Gün başlıkları (Pazartesi, Salı...) Excel tablosunda tespit edilemedi.");
  }

  // 2. A sütunundaki nöbet yerlerini ve günlerdeki öğretmenleri oku
  const places: string[] = [];
  const entries: ParsedDutyEntry[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawPlace = String(row[0] || "").trim();
    if (!rawPlace) continue;

    // Alt bilgi veya görev maddeleri başlangıcında dur
    const upperPlace = rawPlace.toLocaleUpperCase("tr-TR");
    if (
      upperPlace.includes("NÖBETÇI") ||
      upperPlace.includes("NÖBETÇİ") ||
      upperPlace.includes("GÖREVLER") ||
      upperPlace.includes("MÜDÜR") ||
      upperPlace.includes("İMZA") ||
      upperPlace.includes("VAKİT") ||
      upperPlace.includes("AÇIKLAMA")
    ) {
      break;
    }

    let placeHasAssignments = false;
    const rowAssignments: ParsedDutyEntry[] = [];

    DAYS.forEach((day) => {
      const colIdx = dayColMap[day.num];
      if (colIdx !== undefined) {
        const rawCell = String(row[colIdx] || "");
        const cleanedCell = rawCell.replace(/[\r\n]+/g, " ").trim();
        if (cleanedCell) {
          // "1-NESRİN ŞENOL", "1. NESRİN ŞENOL", "1 NESRİN ŞENOL" gibi ön ekleri temizle
          const teacherName = cleanedCell.replace(/^[\d\s\-_.]+/, "").trim();
          if (teacherName.length >= 2) {
            placeHasAssignments = true;
            rowAssignments.push({
              day_of_week: day.num,
              location: rawPlace,
              teacher_name: teacherName,
            });
          }
        }
      }
    });

    // Kullanıcı talebi: "boş olanları da atla"
    // Sadece gerçekten nöbetçi atanmış olan yerleri ve satırları al
    if (placeHasAssignments) {
      if (!places.includes(rawPlace)) {
        places.push(rawPlace);
      }
      entries.push(...rowAssignments);
    }
  }

  // İstatistikleri hesapla
  const countsMap: Record<string, number> = {};
  entries.forEach((e) => {
    countsMap[e.teacher_name] = (countsMap[e.teacher_name] || 0) + 1;
  });

  const teacherDutyCounts = Object.entries(countsMap)
    .map(([teacher_name, count]) => ({
      teacher_name,
      count,
      extra_duties: Math.max(0, count - 1),
    }))
    .sort((a, b) => b.count - a.count || a.teacher_name.localeCompare(b.teacher_name, "tr-TR"));

  return {
    places,
    entries,
    summary: {
      totalAssignments: entries.length,
      distinctTeachers: Object.keys(countsMap).length,
      teacherDutyCounts,
    },
  };
}

/**
 * Nöbet Döndürme Fonksiyonu:
 * Kullanıcı kuralı:
 * Ön bahçe ➔ Arka bahçeye
 * Arka bahçe ➔ Zemine
 * Zemin ➔ 1. kata
 * 1. kat ➔ 2. kata
 * 2. kat ➔ Ön bahçeye
 */
export function rotateDutyLocation(currentLoc: string, places: string[]): string {
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR").trim().replace(/\s+/g, " ");
  const c = norm(currentLoc);

  const findPlace = (pattern: string, fallback: string) => {
    const found = places.find((p) => norm(p).includes(pattern));
    return found || fallback;
  };

  if (c.includes("ön bahçe") || c.includes("on bahce")) {
    return findPlace("arka bahçe", "ARKA BAHÇE");
  }
  if (c.includes("arka bahçe") || c.includes("arka bahce")) {
    return findPlace("zemin", "ZEMİN KAT");
  }
  if (c.includes("zemin")) {
    return findPlace("1. kat", "1. KAT");
  }
  if (c.includes("1. kat") || c.includes("1.kat")) {
    return findPlace("2. kat", "2. KAT");
  }
  if (c.includes("2. kat") || c.includes("2.kat")) {
    return findPlace("ön bahçe", "ÖN BAHÇE");
  }

  // Genel döngüsel yedek
  const idx = places.findIndex((p) => norm(p) === c);
  if (idx !== -1 && places.length > 1) {
    return places[(idx + 1) % places.length];
  }

  return currentLoc;
}
