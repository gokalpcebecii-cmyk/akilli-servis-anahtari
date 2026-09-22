-- OTOİZ — 2026-09-23 staging (ctltjunojlaanzurxpzy)
--
-- Bulgu (işlev): maintenance_records.service_date ve ownership_transfers.
-- transfer_date varsayılanı CURRENT_DATE idi; veritabanı UTC çalıştığı için
-- İstanbul'da 00:00–03:00 arası yapılan servis kaydı BİR ÖNCEKİ güne
-- yazılıyordu (staging'de canlı testte görüldü: 23.09 02:39'daki kayıt
-- 22.09 olarak görünüyordu). Varsayılan İstanbul tarihine çekildi.

alter table public.maintenance_records alter column service_date set default ((now() at time zone 'Europe/Istanbul')::date);
alter table public.ownership_transfers alter column transfer_date set default ((now() at time zone 'Europe/Istanbul')::date);

-- Geçmişte bu hatayla yanlış güne yazılmış kayıtları düzelt (yalnız
-- tarih = UTC günü ve İstanbul günü farklı olan satırlar).
update public.maintenance_records
   set service_date = (created_at at time zone 'Europe/Istanbul')::date
 where service_date = (created_at at time zone 'UTC')::date
   and service_date <> (created_at at time zone 'Europe/Istanbul')::date;
