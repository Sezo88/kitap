'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  RefreshCw, 
  Copy, 
  Check, 
  BookOpen, 
  Search, 
  Share2, 
  FileText, 
  Sparkles,
  Layers,
  GraduationCap,
  AlertCircle
} from 'lucide-react';

interface ClassRequirementItem {
  teacher: string;
  subject: string;
  requirements: string[];
  rawRequirements: string;
}

interface ApiResponse {
  success: boolean;
  allRows: any[];
  classes: string[];
  groupedByClass: Record<string, ClassRequirementItem[]>;
  lastUpdated: string;
  error?: string;
}

export default function IhtiyacPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('ALL'); // 'ALL' veya '5A', '5B' vb.
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Veriyi API'den çek
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ihtiyac', { cache: 'no-store' });
      const json: ApiResponse = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Veri yüklenemedi');
      }
      setData(json);
      // Eğer daha önce seçilen sınıf listede yoksa ALL yap
      if (selectedClass !== 'ALL' && !json.classes.includes(selectedClass)) {
        setSelectedClass('ALL');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Veri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Checkbox toggle
  const toggleItemCheck = (key: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Branşa özel renk ve emoji
  const getSubjectMeta = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('mat')) return { icon: '📐', color: 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400' };
    if (s.includes('türk')) return { icon: '📖', color: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400' };
    if (s.includes('fen')) return { icon: '🔬', color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' };
    if (s.includes('sosyal')) return { icon: '🌍', color: 'border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400' };
    if (s.includes('görsel') || s.includes('resim')) return { icon: '🎨', color: 'border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400' };
    if (s.includes('bilişim')) return { icon: '💻', color: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400' };
    if (s.includes('beden')) return { icon: '⚽', color: 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400' };
    if (s.includes('din')) return { icon: '🕊️', color: 'border-teal-500/30 bg-teal-500/5 text-teal-600 dark:text-teal-400' };
    if (s.includes('tasarım') || s.includes('teknoloji')) return { icon: '✂️', color: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400' };
    if (s.includes('müzik')) return { icon: '🎵', color: 'border-pink-500/30 bg-pink-500/5 text-pink-600 dark:text-pink-400' };
    if (s.includes('ingilizce') || s.includes('yabancı')) return { icon: '🇬🇧', color: 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400' };
    return { icon: '📝', color: 'border-zinc-500/30 bg-zinc-500/5 text-zinc-600 dark:text-zinc-400' };
  };

  // WhatsApp için metin formatlama ve panoya kopyalama
  const copyToClipboard = (className: string) => {
    if (!data) return;
    const items = data.groupedByClass[className] || [];
    if (items.length === 0) return;

    let text = `🎒 *${className} SINIFI DERS ARAÇ VE GEREÇ İHTİYAÇ LİSTESİ*\n`;
    text += `📅 2026 - 2027 Eğitim Öğretim Yılı\n`;
    text += `───────────────────────\n\n`;

    items.forEach((item) => {
      text += `*${item.subject}* (${item.teacher}):\n`;
      item.requirements.forEach((req) => {
        text += ` • ${req}\n`;
      });
      text += `\n`;
    });

    text += `📌 *Not:* Lütfen tüm defter ve malzemelerin üzerine öğrencinin adı, soyadı ve sınıfını yazınız.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Filtrelenmiş liste
  const displayedClasses = useMemo(() => {
    if (!data) return [];
    if (selectedClass === 'ALL') {
      return data.classes;
    }
    return [selectedClass];
  }, [data, selectedClass]);

  // Yazdırma (Print) Fonksiyonu
  const handlePrint = (targetClass: string = 'ALL') => {
    if (targetClass !== 'ALL') {
      setSelectedClass(targetClass);
      setTimeout(() => {
        window.print();
      }, 200);
    } else {
      setSelectedClass('ALL');
      setTimeout(() => {
        window.print();
      }, 200);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. EKRAN GÖRÜNÜMÜ (Ekran UI - Yazdırma sırasında gizlenir: no-print) */}
      {/* ========================================================================= */}
      <div className="no-print max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Üst Başlık Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-8 shadow-xl shadow-indigo-950/10 border border-indigo-700/40">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold backdrop-blur-sm border border-indigo-400/20">
                <GraduationCap className="w-4 h-4 text-indigo-300" />
                <span>2026 - 2027 Eğitim Öğretim Yılı</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Öğrenci Ders Araç - Gereç İhtiyaç Listesi
              </h1>
              <p className="text-indigo-200/80 text-sm max-w-2xl">
                Öğretmenlerimizin Google Form üzerinden bildirdiği güncel ders araç, gereç ve defter listesi. Sınıfınızı seçerek listeyi inceleyebilir, WhatsApp grubuna kopyalayabilir veya tek tıkla toplu A4 çıktısı alabilirsiniz.
              </p>
            </div>

            {/* Aksiyonlar */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={fetchData}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/15 backdrop-blur-sm disabled:opacity-50 cursor-pointer"
                title="Google Sheets'ten verileri yeniden çek"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Yenile</span>
              </button>

              <button
                onClick={() => handlePrint('ALL')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 border border-emerald-400/30 cursor-pointer"
                title="Tüm sınıfları her sayfada bir sınıf olacak şekilde PDF/Yazdır"
              >
                <Printer className="w-4 h-4" />
                <span>Toplu Yazdır / PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hata Durumu */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={fetchData} className="underline text-xs font-bold">Tekrar Dene</button>
          </div>
        )}

        {/* Filtre ve Arama Alanı */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Arama Kutusu */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ders, öğretmen veya malzeme ara (örn: pergel, resim...)"
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition placeholder:text-slate-400"
              />
            </div>

            {/* Hızlı Kopyalama ve Seçili Sınıf Butonları */}
            {selectedClass !== 'ALL' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(selectedClass)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition border border-indigo-200/50 dark:border-indigo-800/50 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopyalandı!' : `${selectedClass} Metnini Kopyala`}</span>
                </button>

                <button
                  onClick={() => handlePrint(selectedClass)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Sadece {selectedClass} Yazdır</span>
                </button>
              </div>
            )}
          </div>

          {/* Sınıf Butonları (Pills) */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Sınıf Seçimi:</span>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={() => setSelectedClass('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedClass === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                ✨ Tüm Sınıflar (Toplu Liste)
              </button>

              {data?.classes.map((cls) => {
                const count = data.groupedByClass[cls]?.length || 0;
                const isSelected = selectedClass === cls;
                return (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-500/20'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{cls}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700/80 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Yükleniyor Durumu */}
        {loading && (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 font-medium">Google Form yanıtları yükleniyor...</p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LİSTE GÖRÜNÜMÜ */}
        {/* ========================================================================= */}
        {!loading && data && (
          <div className="space-y-8">
            {displayedClasses.map((className) => {
              let items = data.groupedByClass[className] || [];

              // Arama filtrelemesi
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                items = items.filter(
                  (item) =>
                    item.subject.toLowerCase().includes(q) ||
                    item.teacher.toLowerCase().includes(q) ||
                    item.requirements.some((r) => r.toLowerCase().includes(q))
                );
              }

              if (items.length === 0 && searchQuery.trim()) {
                return null;
              }

              return (
                <div 
                  key={className} 
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                >
                  {/* Sınıf Başlığı */}
                  <div className="bg-gradient-to-r from-slate-100 via-slate-50 to-white dark:from-slate-800 dark:via-slate-800/60 dark:to-slate-900 px-5 sm:px-6 py-4 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shadow-md shadow-indigo-600/20">
                        {className}
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                          {className} Sınıfı İhtiyaç Listesi
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                          Toplam {items.length} ders için ihtiyaç bildirildi
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(className)}
                        className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                        title="WhatsApp için kopyala"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(className)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Yazdır</span>
                      </button>
                    </div>
                  </div>

                  {/* Ders Kartları Grid */}
                  <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item, idx) => {
                      const meta = getSubjectMeta(item.subject);
                      return (
                        <div
                          key={`${className}-${item.subject}-${idx}`}
                          className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition"
                        >
                          {/* Ders & Öğretmen Başlığı */}
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xl shrink-0">{meta.icon}</span>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                  {item.subject}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {item.teacher}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* İhtiyaç Maddeleri */}
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2 flex-1">
                            {item.requirements.map((req, reqIdx) => {
                              const checkKey = `${className}-${item.subject}-${reqIdx}`;
                              const isChecked = checkedItems[checkKey] || false;
                              return (
                                <div
                                  key={reqIdx}
                                  onClick={() => toggleItemCheck(checkKey)}
                                  className={`group flex items-start gap-2 text-xs leading-relaxed cursor-pointer select-none rounded-lg p-1.5 transition ${
                                    isChecked
                                      ? 'line-through text-slate-400 dark:text-slate-500 bg-emerald-500/5'
                                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border transition ${
                                    isChecked
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="flex-1">{req}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 2. BASKI / PDF GÖRÜNÜMÜ (@media print - Sadece yazdırırken görünür!) */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black bg-white w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 12mm 12mm 12mm;
            }
            body {
              background: white !important;
              color: black !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              font-size: 10pt !important;
            }
            .no-print {
              display: none !important;
            }
            .page-break-after {
              page-break-after: always !important;
              break-after: page !important;
            }
            .avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border: 1px solid #333 !important;
              padding: 6px 8px !important;
            }
          }
        `}} />

        {data && displayedClasses.map((className, pageIdx) => {
          const items = data.groupedByClass[className] || [];
          const isLastPage = pageIdx === displayedClasses.length - 1;

          return (
            <div 
              key={`print-${className}`} 
              className={`p-2 ${!isLastPage ? 'page-break-after' : ''}`}
            >
              {/* Resmi Okul Anteti */}
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <div className="text-xs font-semibold tracking-wider uppercase text-gray-700">
                  T.C. MİLLÎ EĞİTİM BAKANLIĞI
                </div>
                <h1 className="text-xl font-black tracking-tight mt-1">
                  {className} SINIFI DERS ARAÇ - GEREÇ VE İHTİYAÇ LİSTESİ
                </h1>
                <div className="text-xs text-gray-600 font-medium mt-0.5">
                  2026 - 2027 Eğitim Öğretim Yılı
                </div>
              </div>

              {/* İhtiyaç Tablosu */}
              <table className="w-full text-left text-xs mb-4">
                <thead>
                  <tr className="bg-gray-100 font-bold">
                    <th style={{ width: '22%' }} className="text-center">Ders / Branş</th>
                    <th style={{ width: '23%' }} className="text-center">Ders Öğretmeni</th>
                    <th style={{ width: '55%' }}>Gerekli Araç - Gereç ve Malzemeler</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, itemIdx) => (
                    <tr key={itemIdx} className="avoid-break">
                      <td className="font-bold align-top text-center bg-gray-50/50">
                        {item.subject}
                      </td>
                      <td className="align-top text-center text-gray-800">
                        {item.teacher}
                      </td>
                      <td className="align-top">
                        <ul className="space-y-1 list-none pl-0 my-0">
                          {item.requirements.map((req, rIdx) => (
                            <li key={rIdx} className="flex items-start gap-1.5">
                              <span className="font-mono text-gray-600 shrink-0">☐</span>
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Alt Not ve Öğrenci Bilgi Alanı */}
              <div className="border-t border-gray-400 pt-3 mt-4 text-xs space-y-2">
                <div className="flex justify-between items-center text-gray-700">
                  <div>
                    <strong>Öğrenci Adı Soyadı:</strong> ................................................................
                  </div>
                  <div>
                    <strong>Tarih:</strong> {new Date().toLocaleDateString('tr-TR')}
                  </div>
                </div>
                <p className="text-[11px] text-gray-600 italic">
                  * <strong>Önemli Hatırlatma:</strong> Malzemelerin kaybolmasını önlemek adına lütfen tüm defter, kitap, boya ve araç-gereçlerin üzerine öğrencinin adı, soyadı ve sınıfını silinmez kalemle etiketleyiniz.
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
