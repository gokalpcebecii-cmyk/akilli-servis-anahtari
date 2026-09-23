-- OTOİZ — 2026-09-23: rls_auto_enable() bir event trigger fonksiyonu; istemci
-- rollerinin çalıştırma yetkisine ihtiyacı yok (Supabase güvenlik uyarısı).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
