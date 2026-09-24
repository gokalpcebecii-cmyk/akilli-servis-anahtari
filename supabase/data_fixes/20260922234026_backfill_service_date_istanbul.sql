-- OTOİZ — TEK SEFERLİK VERİ DÜZELTMESİ (otomatik migration DEĞİL).
-- Staging'de 20260922234026_istanbul_date_defaults migration'ının ilk
-- sürümüyle birlikte çalıştırıldı. Production'da çalıştırılması AYRI bir
-- karar ve onaya tabidir; çalıştırılmadan önce etkilenecek satır sayısı
-- aşağıdaki SELECT ile görülmelidir.
--
-- Etki: İstanbul'da 00:00–03:00 arası girilip UTC günüyle (bir önceki gün)
-- kaydedilmiş servis kayıtlarının service_date alanını İstanbul gününe çeker.
--
-- Ön kontrol:
--   select count(*) from public.maintenance_records
--    where service_date = (created_at at time zone 'UTC')::date
--      and service_date <> (created_at at time zone 'Europe/Istanbul')::date;
-- Geçmişte bu hatayla yanlış güne yazılmış kayıtları düzelt (yalnız
-- tarih = UTC günü ve İstanbul günü farklı olan satırlar).
update public.maintenance_records
   set service_date = (created_at at time zone 'Europe/Istanbul')::date
 where service_date = (created_at at time zone 'UTC')::date
   and service_date <> (created_at at time zone 'Europe/Istanbul')::date;
