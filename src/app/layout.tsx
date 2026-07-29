import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import CapacitorBackButtonHandler from "@/components/layout/CapacitorBackButtonHandler";
import "./globals.css";

export const metadata: Metadata = {
  title: "O.Y.P. - Okul Yönetim Paneli",
  description: "Okul Yönetim Paneli — Okul kitap okuma, dijital yoklama, akıllı pano, nöbet çizelgeleri ve uzaktan zil yönetim sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          #app-loader {
            position: fixed; inset: 0; z-index: 99999;
            background: #0a0e1a;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 32px;
            transition: opacity 0.3s ease;
          }
          #app-loader.hide { opacity: 0; pointer-events: none; }
          #app-loader .logo {
            width: 80px; height: 80px; border-radius: 20px;
            background: linear-gradient(135deg, #1e3a7a, #2563eb);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 8px 32px rgba(37,99,235,0.35);
          }
          #app-loader .logo span {
            font-size: 28px; font-weight: 900; color: #fff;
            font-family: -apple-system, system-ui, sans-serif;
          }
          #app-loader .bar-wrap {
            width: 180px; height: 3px;
            background: rgba(255,255,255,0.08); border-radius: 3px;
            overflow: hidden;
          }
          #app-loader .bar {
            height: 100%; width: 0%;
            background: linear-gradient(90deg, #2563eb, #60a5fa);
            border-radius: 3px;
            animation: loaderBar 2s ease-in-out forwards;
          }
          @keyframes loaderBar {
            0% { width: 0%; } 30% { width: 40%; }
            60% { width: 65%; } 100% { width: 90%; }
          }
          #app-loader .text {
            font-size: 11px; color: rgba(255,255,255,0.3);
            font-family: -apple-system, system-ui, sans-serif;
          }
        `}} />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <div id="app-loader">
          <div className="logo"><span>OYP</span></div>
          <div className="bar-wrap"><div className="bar"></div></div>
          <div className="text">Yükleniyor...</div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t=setInterval(function(){
              if(document.querySelector('[data-nextjs-router]')||document.querySelector('nav')||document.querySelector('aside')||document.querySelector('main')){
                var el=document.getElementById('app-loader');
                if(el){el.classList.add('hide');setTimeout(function(){el.remove()},400);}
                clearInterval(t);
              }
            },100);
            setTimeout(function(){
              var el=document.getElementById('app-loader');
              if(el){el.classList.add('hide');setTimeout(function(){el.remove()},400);}
              clearInterval(t);
            },5000);
          })();
        `}} />
        <CapacitorBackButtonHandler />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
