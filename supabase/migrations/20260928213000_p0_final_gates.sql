-- OTOİZ P0 — production öncesi son kapılar.
--
-- 1) E-posta kapatma / hesap ele geçirme: doğrulanmamış bir hesabın şifresini
--    kimse bilemez. Auth'a hangi yoldan kayıt gelirse gelsin (uygulama API'si
--    ya da doğrudan /auth/v1/signup), e-postası doğrulanmamış kullanıcının
--    şifresi rastgele bir değerle değiştirilir. Şifre yalnız e-postadaki
--    bağlantının açtığı oturumla, yani e-posta kutusunun sahibi tarafından
--    belirlenir. Böylece başkasının e-postasıyla açılan ön kayıt ne adresi
--    kilitler ne de sonradan o hesaba giriş sağlar.
-- 2) Servis doğrulamalı bakım kayıtları izsiz değişemez: kimlik alanları
--    değiştirilemez, her içerik değişikliği revizyon numarası alır ve eski/yeni
--    değerleriyle audit_log'a yazılır; servis kendi kaydını silemez.
-- 3) Araç sahipliği: istemciden (servis ya da bireysel) owner_user_id
--    atanamaz/değiştirilemez/silinemez; başkasına ait araç silinemez.
--    Sahiplik yalnız resmi devir fonksiyonları (accept_ownership_transfer,
--    activate_product) ya da yalnız service_role'e açık yönetici kurtarma
--    fonksiyonu ile değişir.

---------------------------------------------------------------------------
-- 1) Doğrulanmamış hesapta bilinen şifre olmaz
---------------------------------------------------------------------------
create or replace function public.scramble_unconfirmed_password()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.email_confirmed_at is null
     and new.encrypted_password is not null and new.encrypted_password <> ''
     and (tg_op = 'INSERT' or new.encrypted_password is distinct from old.encrypted_password) then
    new.encrypted_password := extensions.crypt(
      encode(extensions.gen_random_bytes(32), 'base64'),
      extensions.gen_salt('bf', 10)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.scramble_unconfirmed_password() from public, anon, authenticated;

drop trigger if exists trg_scramble_unconfirmed_password on auth.users;
create trigger trg_scramble_unconfirmed_password
  before insert or update of encrypted_password on auth.users
  for each row execute function public.scramble_unconfirmed_password();

-- Mevcut doğrulanmamış hesaplar: önceden bilinen (başkasının koymuş
-- olabileceği) şifreler geçersiz olur. Doğrulanmış hesaplara dokunulmaz.
update auth.users
   set encrypted_password = 'x'
 where email_confirmed_at is null
   and encrypted_password is not null and encrypted_password <> '';

---------------------------------------------------------------------------
-- 2) Bakım kaydı bütünlüğü: revizyon + audit, izsiz değişiklik yok
---------------------------------------------------------------------------
alter table public.maintenance_records
  add column if not exists revision integer not null default 0,
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid;

create or replace function public.guard_maintenance_record_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  -- SECURITY DEFINER içinde current_user her zaman sahiptir; istemci isteği
  -- JWT rolünden anlaşılır (service_role ve sunucu SQL'i serbest).
  v_client boolean := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
                      in ('authenticated', 'anon');
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_old_vals jsonb := '{}'::jsonb;
  v_new_vals jsonb := '{}'::jsonb;
  k text;
  v_staff uuid;
begin
  select id into v_staff from public.staff_users where id = auth.uid();

  if tg_op = 'DELETE' then
    -- Servis doğrulamalı kayıt istemciden doğrudan silinemez (araç silinince
    -- zincirleme silme hâlinde de iz bırakılır).
    if old.tenant_id is not null and pg_trigger_depth() = 1 and v_client then
      raise exception 'maintenance_record_delete_forbidden' using errcode = '42501',
        hint = 'Servis doğrulamalı kayıt silinemez; düzeltme için kaydı güncelleyin.';
    end if;
    insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
    values (old.tenant_id, v_staff, 'maintenance_record_deleted', 'maintenance_records', old.id,
            jsonb_build_object('actor_user_id', auth.uid(), 'vehicle_id', old.vehicle_id,
                               'old', to_jsonb(old), 'cascade', pg_trigger_depth() > 1));
    return old;
  end if;

  -- UPDATE: kimlik alanları değişemez.
  if new.id is distinct from old.id
     or new.vehicle_id is distinct from old.vehicle_id
     or new.tenant_id is distinct from old.tenant_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.client_request_id is distinct from old.client_request_id then
    if v_client then
      raise exception 'maintenance_record_immutable_field' using errcode = '42501';
    end if;
  end if;

  v_old := to_jsonb(old) - array['revision', 'updated_at', 'updated_by'];
  v_new := to_jsonb(new) - array['revision', 'updated_at', 'updated_by'];
  select coalesce(array_agg(key order by key), '{}') into v_changed
    from jsonb_each(v_new) e
   where e.value is distinct from v_old -> e.key;

  if cardinality(v_changed) = 0 then
    -- İçerik değişmedi: revizyon/iz alanları da istemciden oynatılamaz.
    new.revision := old.revision;
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
    return new;
  end if;

  foreach k in array v_changed loop
    v_old_vals := v_old_vals || jsonb_build_object(k, v_old -> k);
    v_new_vals := v_new_vals || jsonb_build_object(k, v_new -> k);
  end loop;

  new.revision := old.revision + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (old.tenant_id, v_staff, 'maintenance_record_revised', 'maintenance_records', old.id,
          jsonb_build_object('actor_user_id', auth.uid(), 'vehicle_id', old.vehicle_id,
                             'revision', new.revision, 'changed_fields', to_jsonb(v_changed),
                             'old', v_old_vals, 'new', v_new_vals));
  return new;
end;
$$;

revoke all on function public.guard_maintenance_record_change() from public, anon, authenticated;

drop trigger if exists trg_guard_maintenance_record_change on public.maintenance_records;
create trigger trg_guard_maintenance_record_change
  before update or delete on public.maintenance_records
  for each row execute function public.guard_maintenance_record_change();

-- Yeni kayıtta revizyon alanları istemciden verilemez.
create or replace function public.init_maintenance_record_revision()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  new.revision := 0;
  new.updated_at := null;
  new.updated_by := null;
  return new;
end;
$$;

revoke all on function public.init_maintenance_record_revision() from public, anon, authenticated;

drop trigger if exists trg_init_maintenance_record_revision on public.maintenance_records;
create trigger trg_init_maintenance_record_revision
  before insert on public.maintenance_records
  for each row execute function public.init_maintenance_record_revision();

---------------------------------------------------------------------------
-- 3) Araç sahipliği yalnız resmi akışla değişir
---------------------------------------------------------------------------
create or replace function public.guard_vehicle_owner_change()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  -- Yalnız istemci (PostgREST üzerinden authenticated/anon) sınırlanır.
  -- SECURITY DEFINER devir/aktivasyon fonksiyonları ve service_role serbest.
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.owner_user_id is not null and new.owner_user_id is distinct from auth.uid() then
      raise exception 'owner_change_forbidden' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'owner_change_forbidden' using errcode = '42501',
        hint = 'Araç sahipliği yalnız resmi devir akışıyla değişir.';
    end if;
    return new;
  end if;

  -- DELETE: sahibi olan araç yalnız sahibi tarafından silinebilir.
  if old.owner_user_id is not null and old.owner_user_id is distinct from auth.uid() then
    raise exception 'owner_change_forbidden' using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke all on function public.guard_vehicle_owner_change() from public, anon, authenticated;

drop trigger if exists trg_guard_vehicle_owner_change on public.vehicles;
create trigger trg_guard_vehicle_owner_change
  before insert or update of owner_user_id or delete on public.vehicles
  for each row execute function public.guard_vehicle_owner_change();

-- Yönetici / destek kurtarma: yalnız service_role (sunucu) çağırabilir,
-- gerekçe zorunlu, eski/yeni sahip audit_log'a yazılır.
create or replace function public.admin_recover_vehicle_owner(
  p_vehicle_id uuid,
  p_new_owner_user_id uuid,
  p_reason text,
  p_admin_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_old uuid;
  v_tenant uuid;
begin
  if coalesce(length(trim(p_reason)), 0) < 5 then
    return jsonb_build_object('ok', false, 'code', 'reason_required');
  end if;
  select owner_user_id, tenant_id into v_old, v_tenant from public.vehicles where id = p_vehicle_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'vehicle_not_found');
  end if;
  if p_new_owner_user_id is not null and not exists (
    select 1 from auth.users u where u.id = p_new_owner_user_id and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('ok', false, 'code', 'new_owner_not_verified');
  end if;
  if p_new_owner_user_id is not distinct from v_old then
    return jsonb_build_object('ok', true, 'code', 'unchanged');
  end if;

  update public.vehicles set owner_user_id = p_new_owner_user_id, updated_at = now() where id = p_vehicle_id;

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (v_tenant, null, 'admin_vehicle_owner_recovered', 'vehicles', p_vehicle_id,
          jsonb_build_object('actor_user_id', p_admin_user_id, 'old_owner_user_id', v_old,
                             'new_owner_user_id', p_new_owner_user_id, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true, 'code', 'recovered', 'old_owner_user_id', v_old);
end;
$$;

revoke all on function public.admin_recover_vehicle_owner(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_recover_vehicle_owner(uuid, uuid, text, uuid) to service_role;
