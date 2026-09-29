-- OTOİZ P0: başkasının e-postasıyla önceden açılmış, DOĞRULANMAMIŞ hesabı
-- bulmak için (yalnız service_role). /api/signup, gerçek e-posta sahibi kayıt
-- olduğunda bu hesabın şifresini kimsenin bilmediği rastgele bir şifreyle
-- değiştirir; böylece önceden kayıt açan kişi, e-posta doğrulandıktan sonra
-- kendi bildiği şifreyle giremez. (Auth, doğrulanmamış hesaba yapılan ikinci
-- signUp'ta şifreyi DEĞİŞTİRMİYOR — staging'de 2026-09-28'de doğrulandı.)
create or replace function public.unconfirmed_auth_user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
    and u.email_confirmed_at is null
    and u.deleted_at is null
  limit 1
$$;
revoke all on function public.unconfirmed_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.unconfirmed_auth_user_id(text) to service_role;
