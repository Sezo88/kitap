"use client";

export function LicenseExpiredBlock() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <div className="bg-red-50 border border-red-200 text-red-950 rounded-2xl p-6 sm:p-8 max-w-lg text-center shadow-lg space-y-4">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl sm:text-2xl font-bold text-red-700">Okul Lisans Süresi Dolmuştur</h1>
        <p className="text-sm text-red-600 leading-relaxed">
          Okulunuzun bu modülü (Yoklama / Zil Sistemi) kullanma lisans süresi sonlanmıştır. 
          Özellikleri tekrar aktif edebilmek için lütfen sistem yöneticiniz <strong>Sezai KAYA</strong> ile iletişime geçiniz.
        </p>
      </div>
    </div>
  );
}
