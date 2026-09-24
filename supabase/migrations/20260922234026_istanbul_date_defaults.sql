-- OTOİZ — 2026-09-23 staging (ctltjunojlaanzurxpzy)
--
-- Bulgu (işlev): maintenance_records.service_date ve ownership_transfers.
-- transfer_date varsayılanı CURRENT_DATE idi; veritabanı UTC çalıştığı için
-- İstanbul'da 00:00–03:00 arası yapılan servis kaydı BİR ÖNCEKİ güne
-- yazılıyordu (staging'de canlı testte görüldü: 23.09 02:39'daki kayıt
-- 22.09 olarak görünüyordu). Varsayılan İstanbul tarihine çekildi.

alter table public.maintenance_records alter column service_date set default ((now() at time zone 'Europe/Istanbul')::date);
alter table public.ownership_transfers alter column transfer_date set default ((now() at time zone 'Europe/Istanbul')::date);

-- NOT (2026-09-24): Staging'de bu dosyanın ilk sürümü, geçmiş kayıtların
-- tarihini düzelten bir UPDATE da içeriyordu. Migration'lar veri
-- değiştirmemeli ve her ortamda müdahalesiz çalışmalı; bu nedenle o satır
-- ayrı, onaya tabi tek seferlik bir veri düzeltmesine taşındı:
--   supabase/data_fixes/20260922234026_backfill_service_date_istanbul.sql
