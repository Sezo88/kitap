@echo off
cd /d c:\Projects\kitap
git init
git add .
git commit -m "Okuma Takip - Next.js 16 + Supabase + PDF/Excel import + Onay sistemi"
git remote add origin https://github.com/Sezo88/kitap.git
git branch -M main
git push -u origin main
echo.
echo Bitti! Kontrol et: https://github.com/Sezo88/kitap
pause
