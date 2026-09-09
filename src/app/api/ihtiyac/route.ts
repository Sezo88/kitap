import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1TYTpBpiyoAjcY33MgGiHdX1rwPPXfWRZHenbWyBtqHU/gviz/tq?tqx=out:csv&sheet=Form%20Yan%C4%B1tlar%C4%B1%201';

/**
 * RFC 4180 uyumlu çift tırnaklı ve çok satırlı CSV ayrıştırıcı
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // atla
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // yoksay
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

export interface ItemRow {
  id: string;
  timestamp: string;
  teacher: string;
  subject: string;
  classes: string[];
  rawRequirements: string;
  requirements: string[];
}

export interface ClassRequirementItem {
  teacher: string;
  subject: string;
  requirements: string[];
  rawRequirements: string;
}

export interface ClassGroup {
  className: string;
  items: ClassRequirementItem[];
}

export async function GET() {
  try {
    const res = await fetch(GOOGLE_SHEET_URL, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/csv; charset=utf-8'
      }
    });

    if (!res.ok) {
      throw new Error(`Google Sheets erişim hatası: ${res.status} ${res.statusText}`);
    }

    const csvText = await res.text();
    const parsedRows = parseCSV(csvText);

    if (parsedRows.length < 2) {
      return NextResponse.json({
        success: true,
        allRows: [],
        classes: [],
        groupedByClass: {},
        lastUpdated: new Date().toISOString()
      });
    }

    // İlk satır başlıklar (Zaman damgası, Ad Soyad, Branş, Sınıf , İhtiyaçlar)
    const dataRows = parsedRows.slice(1);

    const allRows: ItemRow[] = [];
    const classesSet = new Set<string>();

    dataRows.forEach((row, idx) => {
      const timestamp = (row[0] || '').trim();
      const teacher = (row[1] || '').trim();
      const subject = (row[2] || '').trim();
      const classesStr = (row[3] || '').trim();
      const rawReqs = (row[4] || '').trim();

      if (!teacher && !subject && !rawReqs) return;

      const classes = classesStr
        .split(',')
        .map((c) => c.trim().toUpperCase().replace(/\s+/g, ''))
        .filter(Boolean);

      classes.forEach((c) => classesSet.add(c));

      // Maddeleri temizle ve diziye dök (1. veya - gibi maddeleri ayıkla, ama 80 yaprak gibi sayıları koru)
      const reqList = rawReqs
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^(\d+[\.\)\-]\s*|[\*\-\•\–\—]\s*)/, '').trim())
        .filter(Boolean);

      allRows.push({
        id: `row-${idx + 1}`,
        timestamp,
        teacher,
        subject,
        classes,
        rawRequirements: rawReqs,
        requirements: reqList.length > 0 ? reqList : [rawReqs]
      });
    });

    // Sınıfları mantıksal sırala (5A, 5B, 5C, 6A, ... gibi)
    const sortedClasses = Array.from(classesSet).sort((a, b) => {
      const gradeA = parseInt(a, 10) || 0;
      const gradeB = parseInt(b, 10) || 0;
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.localeCompare(b, 'tr');
    });

    // Sınıf bazında gruplama oluştur
    const groupedByClass: Record<string, ClassRequirementItem[]> = {};
    sortedClasses.forEach((cls) => {
      groupedByClass[cls] = [];
    });

    allRows.forEach((row) => {
      row.classes.forEach((cls) => {
        if (!groupedByClass[cls]) {
          groupedByClass[cls] = [];
        }
        groupedByClass[cls].push({
          teacher: row.teacher,
          subject: row.subject,
          requirements: row.requirements,
          rawRequirements: row.rawRequirements
        });
      });
    });

    // Her sınıfın derslerini alfabetik sıralayalım
    Object.keys(groupedByClass).forEach((cls) => {
      groupedByClass[cls].sort((a, b) => a.subject.localeCompare(b.subject, 'tr'));
    });

    return NextResponse.json({
      success: true,
      allRows,
      classes: sortedClasses,
      groupedByClass,
      lastUpdated: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('İhtiyaç verisi çekilirken hata:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Veri çekilemedi' },
      { status: 500 }
    );
  }
}
