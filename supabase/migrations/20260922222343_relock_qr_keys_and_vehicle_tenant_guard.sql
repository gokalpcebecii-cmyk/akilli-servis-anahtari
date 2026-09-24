-- OTOİZ — 2026-09-23 staging düzeltmesi (yalnız staging: ctltjunojlaanzurxpzy)
--
-- Bulgu 1 (P0, drift): staging'e repoda OLMAYAN iki migration uygulanmış
--   20260922212656 grant_qr_keys_write_to_authenticated
--   20260922212719 add_missing_qr_keys_write_policies
-- Bunlar 20260922174352_qr_pilot_lockdown'u geri aldı. Rollback'li testle
-- kanıtlandı: bireysel kullanıcı kendi aracına keyfi QR kodu yazabiliyor,
-- iptal edilmiş QR'ı yeniden aktif edebiliyor, havuza (vehicle_id null)
-- keyfi kod ekleyebiliyor.
-- Düzeltme: lockdown durumuna geri dön. QR yazma yalnız service_role
-- (app/api/qr-uretim, app/api/qr-eslestir) üzerinden.

drop policy if exists "owner_insert_own_vehicle_qr_keys" on public.qr_keys;
drop policy if exists "owner_update_own_vehicle_qr_keys" on public.qr_keys;
drop policy if exists "staff_insert_own_tenant_qr_keys" on public.qr_keys;
drop policy if exists "staff_update_own_tenant_qr_keys" on public.qr_keys;
revoke insert, update, delete on public.qr_keys from anon, authenticated;

-- Bulgu 2 (P1, yeni): vehicles üzerindeki "owner_modify_own_vehicles"
-- politikasında WITH CHECK yok. Bireysel kullanıcı kendi aracının
-- tenant_id'sini herhangi bir servise çevirebiliyor veya herhangi bir
-- tenant_id ile araç ekleyebiliyor → araç o servisin paneline sızıyor.
-- Düzeltme: tenant_id yalnız o tenant'ın personeli (veya service_role)
-- tarafından atanabilir/değiştirilebilir.

create or replace function public.guard_vehicle_tenant_change()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  -- service_role / postgres (sunucu tarafı, auth.uid() yok) serbest
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.tenant_id is not distinct from old.tenant_id then
    return new;
  end if;

  if new.tenant_id is null then
    -- Tenant bağını kaldırma: yalnız eski tenant'ın personeli
    if tg_op = 'UPDATE' and not exists (
      select 1 from public.staff_users s
      where s.id = auth.uid() and s.tenant_id = old.tenant_id
    ) then
      raise exception 'tenant_change_forbidden' using errcode = '42501';
    end if;
    return new;
  end if;

  if not exists (
    select 1 from public.staff_users s
    where s.id = auth.uid() and s.tenant_id = new.tenant_id
  ) then
    raise exception 'tenant_change_forbidden' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_vehicle_tenant_change() from public, anon, authenticated;

drop trigger if exists trg_guard_vehicle_tenant_change on public.vehicles;
create trigger trg_guard_vehicle_tenant_change
  before insert or update of tenant_id on public.vehicles
  for each row execute function public.guard_vehicle_tenant_change();
