-- ============================================================
-- QUIZ_ANSWERS ESKİ VE HATALI TETİKLEYİCİYİ KALDIRMA
-- ============================================================
-- Eski check_quiz_answer tetikleyicisi Türkçe karakterleri (İ/i, I/ı)
-- ASCII karşılaştırdığı için ve puanları +1 eklediği için puanlama sistemini bozuyordu.
-- Artık tüm puanlama, süre bonusu ve Türkçe karakter duyarlılığı sunucu kodunda
-- (Node.js) yapılmaktadır.
-- Bu yüzden aşağıdaki tetikleyiciyi Supabase SQL Editor'de bir kez çalıştırmanız yeterlidir:

DROP TRIGGER IF EXISTS trg_check_answer ON public.quiz_answers;
DROP FUNCTION IF EXISTS public.check_quiz_answer();
