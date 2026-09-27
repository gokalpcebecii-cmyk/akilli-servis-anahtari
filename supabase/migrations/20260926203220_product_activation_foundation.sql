-- OTOİZ Faz 3 — fiziksel ürün (anahtarlık) + self-aktivasyon temeli.
--
-- Tek gerçek kaynak: public.qr_keys. Her fiziksel ürün qr_keys'te TEK satırdır
-- (product_id = qr_keys.id). Ayrı bir ürün tablosu açılmaz; yalnız parti
-- bilgisi için küçük public.product_batches tablosu eklenir.
--
-- Yalnız EKLEMELİ değişiklikler. Resolver (resolve_qr_token) ve go-host
-- sözleşmesi DEĞİŞMEZ. Mevcut akışlar (yönetici ata/iptal, servis eşleştir,
-- bireysel bağla/iptal) aynen çalışır; status sütunu tetikleyiciyle
-- revoked_at / vehicle_id'den türetilir, yani mevcut kodlar status'u hiç
-- bilmeden doğru durumu üretir.
--
-- Durum modeli (qr_keys.status):
--   created | in_stock | distributed   → araca bağlı değil, iptal değil
--   activated                          → vehicle_id dolu, revoked_at boş
--   revoked | replaced | archived      → revoked_at dolu (terminal; resolver 410)
-- Tutarlılık CHECK kısıtıyla zorunlu; replaced/archived bir daha değişmez.
--
-- Aktivasyon kodu: yalnız bcrypt özeti (pgcrypto crypt, bf) saklanır; düz
-- metin yalnız parti üretiminde bir kez döner. Ürün bir araca bağlandığı an
-- (hangi yoldan olursa olsun) özet silinir → kod tekrar kullanılamaz.
-- Kaba kuvvet: ürün başına 5 hatalı denemede 30 dk kilit, kullanıcı başına
-- saatte 10 hatalı deneme sınırı.
--
-- Geri dönüş (roll-forward): yeni fonksiyonlar/tetikleyici drop edilir,
-- get_public_vehicle_passport önceki gövdesine döner, yeni sütunlar/tablolar
-- kaldırılabilir (mevcut sütunlara dokunulmadı).

-- ---------------------------------------------------------------------------
-- 1) Parti tablosu (yalnız service_role)
-- ---------------------------------------------------------------------------
create table if not exists public.product_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  quantity integer not null check (quantity between 1 and 500),
  default_channel text check (default_channel in ('internet', 'servis', 'bayi', 'merkez', 'bireysel')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.product_batches enable row level security;
revoke all on public.product_batches from public, anon, authenticated;
grant select, insert, update on public.product_batches to service_role;

-- Aktivasyon denemeleri (kullanıcı başına hız sınırı). Yalnız SECURITY
-- DEFINER fonksiyon yazar; istemci rollerine kapalı.
create table if not exists public.product_activation_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  qr_key_id uuid references public.qr_keys(id) on delete set null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists product_activation_attempts_user_idx
  on public.product_activation_attempts (user_id, created_at desc);
alter table public.product_activation_attempts enable row level security;
revoke all on public.product_activation_attempts from public, anon, authenticated;
grant select, delete on public.product_activation_attempts to service_role;

create sequence if not exists public.product_serial_seq start 1;
revoke all on sequence public.product_serial_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) qr_keys: ürün alanları
-- ---------------------------------------------------------------------------
alter table public.qr_keys
  add column if not exists serial_no text,
  add column if not exists batch_id uuid references public.product_batches(id) on delete restrict,
  add column if not exists activation_code_hash text,
  add column if not exists activation_failed_attempts integer not null default 0,
  add column if not exists activation_locked_until timestamptz,
  add column if not exists distribution_channel text,
  add column if not exists distributor_tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists status text not null default 'created',
  add column if not exists activated_by uuid references auth.users(id) on delete set null,
  add column if not exists replaces_qr_key_id uuid references public.qr_keys(id) on delete restrict;

alter table public.qr_keys add constraint qr_keys_serial_no_key unique (serial_no);
alter table public.qr_keys add constraint qr_keys_serial_no_format
  check (serial_no is null or serial_no ~ '^OTZ-[0-9]{6,}$');
alter table public.qr_keys add constraint qr_keys_distribution_channel_check
  check (distribution_channel is null or distribution_channel in ('internet', 'servis', 'bayi', 'merkez', 'bireysel'));
alter table public.qr_keys add constraint qr_keys_status_check
  check (status in ('created', 'in_stock', 'distributed', 'activated', 'revoked', 'replaced', 'archived'));
alter table public.qr_keys add constraint qr_keys_product_fields
  check (activation_code_hash is null or (serial_no is not null and batch_id is not null));
create unique index if not exists qr_keys_replaces_once
  on public.qr_keys (replaces_qr_key_id) where replaces_qr_key_id is not null;
create index if not exists qr_keys_batch_idx on public.qr_keys (batch_id) where batch_id is not null;

-- Mevcut satırların durumu. qr_keys_active_code_format staging'de eski kısa
-- test kodları nedeniyle NOT VALID; UPDATE bu satırlarda kısıtı yeniden
-- denetleyeceği için kısıt geri doldurma süresince kaldırılıp AYNI tanımla
-- (ve aynı koşullu VALIDATE ile) geri eklenir.
alter table public.qr_keys drop constraint if exists qr_keys_active_code_format;
update public.qr_keys
set status = case
  when revoked_at is not null then 'revoked'
  when vehicle_id is not null then 'activated'
  else 'created'
end;
alter table public.qr_keys add constraint qr_keys_active_code_format
  check (revoked_at is not null or code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$') not valid;
do $$
begin
  if not exists (
    select 1 from public.qr_keys
    where revoked_at is null and code !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$'
  ) then
    alter table public.qr_keys validate constraint qr_keys_active_code_format;
  end if;
end
$$;

alter table public.qr_keys add constraint qr_keys_status_consistent check (
  case
    when revoked_at is not null then status in ('revoked', 'replaced', 'archived')
    when vehicle_id is not null then status = 'activated'
    else status in ('created', 'in_stock', 'distributed')
  end
);

-- ---------------------------------------------------------------------------
-- 3) Durum tetikleyicisi: status'u gerçeklerden türetir, kodu tüketir.
--    (trg_guard_qr_key_revoked alfabetik olarak önce çalışır.)
-- ---------------------------------------------------------------------------
create or replace function public.sync_qr_key_status()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE' and old.status in ('replaced', 'archived') and new.status is distinct from old.status then
    raise exception 'qr_status_terminal' using errcode = '42501';
  end if;
  if new.revoked_at is not null then
    if new.status not in ('revoked', 'replaced', 'archived') then
      new.status := 'revoked';
    end if;
    new.activation_code_hash := null;
  elsif new.vehicle_id is not null then
    new.status := 'activated';
    new.activation_code_hash := null;
    new.activation_failed_attempts := 0;
    new.activation_locked_until := null;
  elsif new.status not in ('created', 'in_stock', 'distributed') then
    raise exception 'qr_status_inconsistent' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke all on function public.sync_qr_key_status() from public, anon, authenticated;

drop trigger if exists trg_qr_key_status on public.qr_keys;
create trigger trg_qr_key_status
  before insert or update on public.qr_keys
  for each row execute function public.sync_qr_key_status();

-- ---------------------------------------------------------------------------
-- 4) Parti üretimi (yalnız service_role; /api/admin/urunler çağırır).
--    Token ve kodlar sunucuda CSPRNG ile üretilir (lib/qrToken.js,
--    lib/activationCode.js); burada yalnız doğrulanır, kod özetlenir ve
--    tek işlemde (atomik) yazılır.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_product_batch(
  p_label text, p_channel text, p_actor uuid, p_tokens text[], p_codes text[]
)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_n integer := coalesce(cardinality(p_tokens), 0);
  v_batch uuid;
  v_items jsonb;
begin
  if v_n < 1 or v_n > 500 or v_n <> coalesce(cardinality(p_codes), 0) then
    raise exception 'batch_size_invalid' using errcode = '22023';
  end if;
  if p_channel is not null and p_channel not in ('internet', 'servis', 'bayi', 'merkez', 'bireysel') then
    raise exception 'channel_invalid' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_tokens) t where t is null or t !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$')
     or exists (select 1 from unnest(p_codes) c where c is null or c !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$') then
    raise exception 'token_or_code_format' using errcode = '22023';
  end if;
  if (select count(distinct t) from unnest(p_tokens) t) <> v_n
     or (select count(distinct c) from unnest(p_codes) c) <> v_n then
    raise exception 'duplicate_in_batch' using errcode = '23505';
  end if;

  insert into public.product_batches (label, quantity, default_channel, created_by)
  values (coalesce(nullif(trim(p_label), ''), 'Parti'), v_n, p_channel, p_actor)
  returning id into v_batch;

  for i in 1..v_n loop
    insert into public.qr_keys (code, batch_label, created_by, serial_no, batch_id, activation_code_hash, distribution_channel, status)
    values (
      p_tokens[i],
      coalesce(nullif(trim(p_label), ''), 'Parti'),
      p_actor,
      'OTZ-' || lpad(nextval('public.product_serial_seq')::text, 6, '0'),
      v_batch,
      extensions.crypt(p_codes[i], extensions.gen_salt('bf', 8)),
      p_channel,
      'created'
    );
  end loop;

  select jsonb_agg(jsonb_build_object('id', q.id, 'serial_no', q.serial_no, 'token', q.code) order by q.serial_no)
  into v_items
  from public.qr_keys q
  where q.batch_id = v_batch;

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (null, null, 'product_batch_created', 'product_batches', v_batch,
          jsonb_build_object('count', v_n, 'channel', p_channel, 'label', p_label, 'actor_user_id', p_actor, 'via', 'admin_panel'));

  return jsonb_build_object('batch_id', v_batch, 'items', v_items);
end;
$function$;
revoke all on function public.admin_create_product_batch(text, text, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function public.admin_create_product_batch(text, text, uuid, text[], text[]) to service_role;

-- Destek: henüz aktive edilmemiş ürüne yeni aktivasyon kodu (kayıp kart).
create or replace function public.admin_reissue_activation_code(p_id uuid, p_code text, p_actor uuid)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_serial text;
begin
  if p_code is null or p_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$' then
    raise exception 'code_format' using errcode = '22023';
  end if;
  update public.qr_keys
  set activation_code_hash = extensions.crypt(p_code, extensions.gen_salt('bf', 8)),
      activation_failed_attempts = 0,
      activation_locked_until = null
  where id = p_id and status in ('created', 'in_stock', 'distributed') and serial_no is not null
  returning serial_no into v_serial;
  if v_serial is null then
    return jsonb_build_object('ok', false, 'error', 'not_reissuable');
  end if;
  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (null, null, 'product_activation_code_reissued', 'qr_keys', p_id,
          jsonb_build_object('serial_no', v_serial, 'actor_user_id', p_actor, 'via', 'admin_panel'));
  return jsonb_build_object('ok', true, 'serial_no', v_serial);
end;
$function$;
revoke all on function public.admin_reissue_activation_code(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_reissue_activation_code(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Self-aktivasyon (authenticated). p_identifier: QR token'ı (26 karakter)
--    ya da seri no (OTZ-000123). p_vehicle_id boşsa yalnız kodu doğrular
--    (tüketmez); doluysa ürünü o araca bağlar.
--    Hata sonuçları exception değil jsonb döner: başarısız denemeler
--    sayaçlara YAZILIR ve geri alınmaz.
-- ---------------------------------------------------------------------------
create or replace function public.activate_product(p_identifier text, p_code text, p_vehicle_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_ident text := lower(regexp_replace(coalesce(p_identifier, ''), '[[:space:]-]+', '', 'g'));
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]+', '', 'g'));
  q_id uuid;
  q_status text;
  q_hash text;
  q_failed integer;
  q_locked timestamptz;
  q_serial text;
  q_channel text;
  v_owner uuid;
  v_tenant uuid;
  v_prev uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'email_not_verified');
  end if;
  if exists (select 1 from public.staff_users s where s.id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'staff_account');
  end if;
  if (select count(*) from public.product_activation_attempts a
      where a.user_id = v_uid and not a.success and a.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  if v_ident ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$' then
    select q.id, q.status, q.activation_code_hash, q.activation_failed_attempts, q.activation_locked_until, q.serial_no, q.distribution_channel
    into q_id, q_status, q_hash, q_failed, q_locked, q_serial, q_channel
    from public.qr_keys q where q.code = v_ident for update;
  elsif v_ident ~ '^otz[0-9]{6,}$' then
    select q.id, q.status, q.activation_code_hash, q.activation_failed_attempts, q.activation_locked_until, q.serial_no, q.distribution_channel
    into q_id, q_status, q_hash, q_failed, q_locked, q_serial, q_channel
    from public.qr_keys q where q.serial_no = 'OTZ-' || substr(v_ident, 4) for update;
  end if;

  if q_id is null then
    insert into public.product_activation_attempts (user_id, qr_key_id, success) values (v_uid, null, false);
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if q_status in ('revoked', 'replaced', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;
  if q_status = 'activated' then
    return jsonb_build_object('ok', false, 'error', 'already_activated');
  end if;
  if q_hash is null then
    return jsonb_build_object('ok', false, 'error', 'not_activatable');
  end if;
  if q_locked is not null and q_locked > now() then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$' or extensions.crypt(v_code, q_hash) <> q_hash then
    insert into public.product_activation_attempts (user_id, qr_key_id, success) values (v_uid, q_id, false);
    if q_failed + 1 >= 5 then
      update public.qr_keys
      set activation_failed_attempts = 0, activation_locked_until = now() + interval '30 minutes'
      where id = q_id;
      insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
      values (null, null, 'product_activation_locked', 'qr_keys', q_id,
              jsonb_build_object('serial_no', q_serial, 'actor_user_id', v_uid, 'via', 'self_activation'));
      return jsonb_build_object('ok', false, 'error', 'locked');
    end if;
    update public.qr_keys set activation_failed_attempts = q_failed + 1 where id = q_id;
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Kod doğru.
  if p_vehicle_id is null then
    if q_failed > 0 or q_locked is not null then
      update public.qr_keys set activation_failed_attempts = 0, activation_locked_until = null where id = q_id;
    end if;
    return jsonb_build_object('ok', true, 'verified', true, 'serial_no', q_serial);
  end if;

  select v.owner_user_id, v.tenant_id into v_owner, v_tenant from public.vehicles v where v.id = p_vehicle_id;
  if v_owner is null or v_owner <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'vehicle_forbidden');
  end if;
  if exists (select 1 from public.qr_keys q where q.vehicle_id = p_vehicle_id and q.revoked_at is null) then
    return jsonb_build_object('ok', false, 'error', 'vehicle_has_active_qr');
  end if;

  -- Replacement temeli: aracın en son iptal edilen (henüz yenilenmemiş)
  -- anahtarlığı bu ürünle değiştirilmiş sayılır; teknik geçmiş korunur.
  select q.id into v_prev from public.qr_keys q
  where q.vehicle_id = p_vehicle_id and q.status = 'revoked'
  order by q.revoked_at desc limit 1
  for update;

  begin
    update public.qr_keys
    set vehicle_id = p_vehicle_id, assigned_at = now(), activated_by = v_uid, replaces_qr_key_id = v_prev
    where id = q_id;
    if v_prev is not null then
      update public.qr_keys set status = 'replaced' where id = v_prev;
    end if;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'vehicle_has_active_qr');
  end;

  insert into public.product_activation_attempts (user_id, qr_key_id, success) values (v_uid, q_id, true);
  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (v_tenant, null, 'product_activated', 'qr_keys', q_id,
          jsonb_build_object('serial_no', q_serial, 'vehicle_id', p_vehicle_id, 'channel', q_channel,
                             'replaces_qr_key_id', v_prev, 'actor_user_id', v_uid, 'via', 'self_activation'));

  return jsonb_build_object('ok', true, 'serial_no', q_serial, 'vehicle_id', p_vehicle_id, 'replaced', v_prev is not null);
end;
$function$;
revoke all on function public.activate_product(text, text, uuid) from public, anon;
grant execute on function public.activate_product(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Pasaport: boştaki üründe "etkinleştirilebilir" bilgisi (yalnız bool).
--    Gövdenin geri kalanı birebir aynıdır.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_vehicle_passport(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_qr record;
  v_vehicle record;
  v_tenant record;
  v_records jsonb;
  v_items jsonb;
begin
  select code, vehicle_id, revoked_at, activation_code_hash into v_qr
  from public.qr_keys
  where code = p_code;

  if not found or v_qr.revoked_at is not null then
    return null;
  end if;

  if v_qr.vehicle_id is null then
    return jsonb_build_object('status', 'unassigned', 'activatable', v_qr.activation_code_hash is not null);
  end if;

  select id, plate, brand, model, current_km, tenant_id into v_vehicle
  from public.vehicles
  where id = v_qr.vehicle_id;

  if not found then
    return null;
  end if;

  select name, phone, address into v_tenant
  from public.tenants
  where id = v_vehicle.tenant_id and approval_status = 'approved';

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'description', r.description,
      'created_at', r.created_at,
      'km_at_service', r.km_at_service,
      'service_verified', (r.tenant_id is not null and t.approval_status = 'approved')
    ) order by r.created_at desc), '[]'::jsonb)
  into v_records
  from public.maintenance_records r
  left join public.tenants t on t.id = r.tenant_id
  where r.vehicle_id = v_vehicle.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'item_key', item_key,
      'last_service_date', last_service_date,
      'last_service_km', last_service_km,
      'interval_km', interval_km,
      'interval_months', interval_months
    )), '[]'::jsonb)
  into v_items
  from public.maintenance_items
  where vehicle_id = v_vehicle.id;

  return jsonb_build_object(
    'status', 'active',
    'vehicle', jsonb_build_object(
      'plate', case when v_vehicle.plate is null then null else
        left(replace(v_vehicle.plate, ' ', ''), 2) || ' ••• ' || right(replace(v_vehicle.plate, ' ', ''), 2) end,
      'brand', v_vehicle.brand,
      'model', v_vehicle.model,
      'current_km', v_vehicle.current_km
    ),
    'tenant', jsonb_build_object(
      'name', v_tenant.name,
      'phone', v_tenant.phone,
      'address', v_tenant.address
    ),
    'maintenance_records', v_records,
    'maintenance_items', v_items
  );
end;
$function$;
