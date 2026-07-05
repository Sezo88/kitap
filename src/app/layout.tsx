import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduOS - Eğitim Yönetim ve Okul İşletim Sistemi",
  description: "Okul kitap okuma, dijital yoklama, akıllı pano, nöbet çizelgeleri ve uzaktan zil yönetim sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
