/**
 * jsPDF varsayilan fontlari Turkce karakterleri desteklemedigi icin
 * PDF ciktilari icin Roboto fontunu CDN'den yukleyip kaydeden yardimci.
 *
 * Font yuklenemezse safeText() ile Turkce karakterleri ASCII'ye cevirir.
 */

// Google Fonts'dan Roboto Regular - Turkce karakter destegi tam
const ROBOTO_URL =
  "https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Regular.ttf";

let cachedBase64: string | null = null;
let loadPromise: Promise<string | null> | null = null;

export async function loadTurkishFont(): Promise<string | null> {
  if (cachedBase64) return cachedBase64;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch(ROBOTO_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      cachedBase64 = btoa(binary);
      return cachedBase64;
    } catch {
      return null;
    }
  })();

  return loadPromise;
}

/**
 * jsPDF dokumanina Roboto fontunu ekler.
 * Basariliysa true, degilse false doner.
 */
export async function setupTurkishFont(doc: any): Promise<boolean> {
  const base64 = await loadTurkishFont();
  if (base64) {
    doc.addFileToVFS("Roboto-Regular.ttf", base64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.setFont("Roboto");
    return true;
  }
  return false;
}

const TR_MAP: Record<string, string> = {
  "İ": "I", // İ
  "Ş": "S", // Ş
  "Ğ": "G", // Ğ
  "Ü": "U", // Ü
  "Ö": "O", // Ö
  "Ç": "C", // Ç
  "ı": "i", // ı
  "ş": "s", // ş
  "ğ": "g", // ğ
  "ü": "u", // ü
  "ö": "o", // ö
  "ç": "c", // ç
};

/** Turkce karakterleri ASCII karsiliklarina cevirir */
export function safeText(text: string, fontReady: boolean): string {
  if (fontReady) return text;
  return text.replace(/[İŞĞÜÖÇışğüöç]/g, (c) => TR_MAP[c] || c);
}
