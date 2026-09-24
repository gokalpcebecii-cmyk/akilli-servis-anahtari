-- OTOİZ — NÖTRLENMİŞ MIGRATION (bilinçli olarak işlem yapmaz).
-- Bu sürüm numarası staging'in migration geçmişinde kayıtlıdır: 22.09.2026'da
-- staging'e repo dışından uygulanmış qr_keys yazma politikalarının kaydıdır;
-- etkisi 20260922222343_relock_qr_keys_and_vehicle_tenant_guard ile geri
-- alınmıştır. Production dahil hiçbir ortamda tekrar çalıştırılmaması için
-- içerik kaldırıldı. Orijinal içerik izlenebilirlik için:
--   supabase/staging_history/20260922212719_add_missing_qr_keys_write_policies.sql
select 1;
