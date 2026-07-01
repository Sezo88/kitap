import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Okul Asistanı",
  description: "Okul kitap okuma, yoklama ve temizlik takip sistemi",
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
