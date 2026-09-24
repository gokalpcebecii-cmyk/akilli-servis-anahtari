-- DRIFT KAYDI: Bu migration staging'e repo DIŞINDAN uygulanmıştı (22.09.2026 21:26 UTC).
-- Tarihçenin staging ile birebir eşleşmesi için olduğu gibi kaydedildi.
-- Etkisi 20260922222343_relock_qr_keys_and_vehicle_tenant_guard ile GERİ ALINDI.
-- Production'a UYGULANMAMALIDIR.
grant insert, update, delete on public.qr_keys to authenticated;
