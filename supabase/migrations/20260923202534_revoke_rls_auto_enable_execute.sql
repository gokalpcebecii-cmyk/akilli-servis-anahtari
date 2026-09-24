-- OTOİZ — 2026-09-23: rls_auto_enable() bir event trigger fonksiyonu; istemci
-- rollerinin çalıştırma yetkisine ihtiyacı yok (Supabase güvenlik uyarısı).
-- 2026-09-24: fonksiyon yalnız bazı projelerde (staging) Supabase tarafından
-- oluşturuluyor; Production'da yok. Migration'ın her ortamda müdahalesiz
-- çalışması için koşullu hale getirildi (staging'deki etkisi aynıdır).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
