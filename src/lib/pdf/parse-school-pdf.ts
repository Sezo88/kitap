"use server";

import pdfParse from "pdf-parse";

export interface ParsedStudent {
  fullName: string;
  studentNo: string;
  className: string;
}

export interface ParseResult {
  success: boolean;
  students: ParsedStudent[];
  classes: string[];
  errors: string[];
}

export async function parseSchoolPDF(formData: FormData): Promise<ParseResult> {
  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, students: [], classes: [], errors: ["Dosya bulunamadı"] };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let pdfData: Awaited<ReturnType<typeof pdfParse>>;
  try {
    pdfData = await pdfParse(buffer);
  } catch {
    return { success: false, students: [], classes: [], errors: ["PDF okunamadı, dosya bozuk olabilir"] };
  }

  const students: ParsedStudent[] = [];
  const errors: string[] = [];

  // Split text by pages and process each page
  const pageTexts = splitByPages(pdfData.text);

  for (const pageText of pageTexts) {
    const className = extractClassName(pageText);
    if (!className) {
      errors.push("Bir sayfada sınıf adı bulunamadı, atlanıyor");
      continue;
    }

    const pageStudents = extractStudents(pageText, className);
    students.push(...pageStudents);

    if (pageStudents.length === 0) {
      errors.push(`${className}: Öğrenci bulunamadı`);
    }
  }

  const uniqueClasses = [...new Set(students.map((s) => s.className))];

  return {
    success: students.length > 0,
    students,
    classes: uniqueClasses,
    errors,
  };
}

function splitByPages(text: string): string[] {
  // PDF text usually has form feed or multiple newlines between pages
  // Try splitting by form feed first
  const pages = text.split(/\f/);
  if (pages.length > 1) return pages.filter((p) => p.trim());

  // Try splitting by page header marker
  const pageHeaderMarker = "CinsiyetiSoyadıAdıÖğrenci NoS.No";
  const headerParts = text.split(pageHeaderMarker);
  if (headerParts.length > 1) {
    const result: string[] = [];
    for (let i = 1; i < headerParts.length; i++) {
      result.push(pageHeaderMarker + "\n" + headerParts[i]);
    }
    return result;
  }

  // Try splitting by "SINIF LİSTESİ" marker
  const parts = text.split(/SINIF\s+LİSTESİ/i);
  if (parts.length > 1) {
    // Reconstruct: parts[0] is before first list, parts[1..] each start with a class list
    const result: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      result.push("SINIF LİSTESİ" + parts[i]);
    }
    return result;
  }

  return [text];
}

function extractClassName(text: string): string | null {
  // Pattern: "Şube : 5/A" or "Şube: 5/A" or "ŞUBE : 5/A"
  const match = text.match(/Şube\s*:\s*([\d/A-Za-z]+)/i);
  if (match) return match[1].trim();

  // Pattern: "5. Sınıf / A Şubesi" or "5. Sınıf-Hafif Zihinsel / A Şubesi"
  const match2 = text.match(/(\d+)\.\s*Sınıf\s*(?:-\s*([^\/]+?))?\s*\/\s*([A-Za-zÇĞİÖŞÜçğıöşü\d]+)\s*Şubesi/i);
  if (match2) {
    const grade = match2[1];
    const suffix = match2[2] ? `-${match2[2].trim()}` : '';
    const branch = match2[3].trim();
    return `${grade}/${branch}${suffix}`;
  }

  // Alternative: look for grade/class pattern like "5/A", "5-A", "6/B"
  const altMatch = text.match(/(\d+[/\-][A-Z])\s+Sınıf/i);
  if (altMatch) return altMatch[1].trim();

  return null;
}

function extractStudents(text: string, className: string): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  const lines = text.split(/\r?\n/);

  let inStudentTable = false;
  let headerFound = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect table header
    if (/S\.?No|Öğrenci\s*No|Sıra\s*No|CinsiyetiSoyadıAdı/i.test(line)) {
      headerFound = true;
      inStudentTable = true;
      continue;
    }

    if (!inStudentTable || !headerFound) continue;

    // Stop at certain markers
    if (/Sınıf\s*Öğretmeni|TOPLAM|Sayfa|İSTANBUL|T\.C\.|VALİLİĞİ|MÜDÜRLÜĞÜ|MÜDÜR|Öğretmen/i.test(line) && !/^\d/.test(line)) {
      // Don't stop if line starts with a number (could be last student row)
      if (students.length > 0 && !/^\d/.test(line)) {
        inStudentTable = false;
        continue;
      }
    }

    // Attempt Pattern 1: E-okul format where Erkek/Kız combines adjacent fields
    // e.g. " 2HÜSEYİNErkekÇELİK"
    const matchNew = line.match(/^\s*(\d+)\s*(.*?)\s*(Erkek|Kız)\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s]+)$/i);
    if (matchNew) {
      const studentNo = matchNew[1];
      const namePart = matchNew[2].trim();
      const surnamePart = matchNew[4].trim();
      const fullName = `${namePart} ${surnamePart}`.replace(/\s+/g, " ");

      if (
        fullName.length > 3 &&
        !/^(S\.?No|Öğrenci|Sıra|SINIF|TOPLAM|Sayfa)/i.test(fullName) &&
        /^[A-ZÇĞİÖŞÜ]/.test(fullName)
      ) {
        students.push({ fullName, studentNo, className });
        continue;
      }
    }

    // Attempt Pattern 2: Original table row format
    // e.g. "1 2580 ABDURRAHMAN TANAĞARDIGİL E"
    const matchOriginal = line.match(
      /^\s*(\d+)\s+(\d{3,6})\s+([A-ZÇĞİÖŞÜa-zçğıöşü\s]+?)(?:\s+[EK]\s+|\s*$)/
    );
    if (matchOriginal) {
      const studentNo = matchOriginal[2];
      const fullName = matchOriginal[3].trim().replace(/\s+/g, " ");

      if (
        fullName.length > 3 &&
        !/^(S\.?No|Öğrenci|Sıra|SINIF|TOPLAM|Sayfa)/i.test(fullName) &&
        /^[A-ZÇĞİÖŞÜ]/.test(fullName)
      ) {
        students.push({ fullName, studentNo, className });
      }
    }
  }

  return students;
}
