-- OTOİZ Aşama 1 — kalıcı QR resolver temeli (go.<final-domain>/<token>).
-- Yalnız EKLEMELİ değişiklikler; mevcut veri değiştirilmez.
--
-- 1) resolve_qr_token(text): resolver'ın ihtiyaç duyduğu TEK bilgi olan token
--    durumunu döndürür ('not_found' | 'revoked' | 'unassigned' | 'active').
--    vehicle_id, plaka veya başka hiçbir alan döndürmez. anon rolü qr_keys
--    tablosunu okuyamaz (RLS/grant değişmez); bu dar SECURITY DEFINER
--    fonksiyon resolver'ın service role KULLANMADAN çalışmasını sağlar.
-- 2) qr_keys_active_code_format: iptal edilmemiş her kod, sunucu üreticisinin
--    (lib/qrToken.js) formatında olmalı: 26 karakter, 31 harflik alfabe
--    (≈128,8 bit). Kısa/zayıf bir kodun ileride aktif hale gelmesini engeller.
--    Mevcut satırlarda ihlal yoksa VALIDATE edilir; varsa (yalnız staging'deki
--    eski test kodları) NOT VALID kalır — bu satırlar yine yalnızca iptal
--    edilebilir, başka bir güncelleme kabul edilmez.
-- 3) qr_keys.vehicle_id FK'si ON DELETE SET NULL → ON DELETE RESTRICT.
--    Eski davranışta araç silinirse aktif (basılı) token "boşta"ya düşüp başka
--    araca bağlanabiliyordu. Artık QR geçmişi olan araç silinemez
--    (mimari karar: devret/arşivle modeli). Uygulamada araç silen akış yok.
--
-- Geri dönüş (roll-forward): üç değişiklik de bağımsızdır;
--   drop function public.resolve_qr_token(text);
--   alter table public.qr_keys drop constraint qr_keys_active_code_format;
--   FK eski haline: drop + add ... on delete set null.

create or replace function public.resolve_qr_token(p_token text)
 returns text
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_vehicle_id uuid;
  v_revoked_at timestamptz;
begin
  if p_token is null or p_token !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$' then
    return 'not_found';
  end if;
  select vehicle_id, revoked_at into v_vehicle_id, v_revoked_at
  from public.qr_keys
  where code = p_token;
  if not found then
    return 'not_found';
  end if;
  if v_revoked_at is not null then
    return 'revoked';
  end if;
  if v_vehicle_id is null then
    return 'unassigned';
  end if;
  return 'active';
end;
$function$;

revoke all on function public.resolve_qr_token(text) from public;
grant execute on function public.resolve_qr_token(text) to anon, authenticated, service_role;

alter table public.qr_keys drop constraint if exists qr_keys_active_code_format;
alter table public.qr_keys add constraint qr_keys_active_code_format
  check (revoked_at is not null or code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$') not valid;

do $$
begin
  if not exists (
    select 1 from public.qr_keys
    where revoked_at is null and code !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$'
  ) then
    alter table public.qr_keys validate constraint qr_keys_active_code_format;
  else
    raise notice 'qr_keys_active_code_format NOT VALID bırakıldı: eski formatta aktif kod var (yalnız iptal edilebilirler).';
  end if;
end
$$;

alter table public.qr_keys drop constraint qr_keys_vehicle_id_fkey;
alter table public.qr_keys add constraint qr_keys_vehicle_id_fkey
  foreign key (vehicle_id) references public.vehicles(id) on delete restrict;
