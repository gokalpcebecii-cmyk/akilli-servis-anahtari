-- OTOİZ P1 — ölçek, görünürlük ve operasyon (5.000 araç öncesi).
-- Önce staging; production için proje sahibinin ayrı onayı gerekir.
--
--  1) plate_key: ayraçsız/büyük harf plaka anahtarı (sunucu tarafı arama)
--  2) Ölçümle doğrulanmış indexler (duplicate yok: iki eski index yerine yenisi)
--  3) RLS: auth.uid() satır başına değil sorgu başına bir kez; servis kuralları
--     "= any(array(...))". Yetki mantığı DEĞİŞMEZ (RLS regresyon testi aynı).
--  4) Sayfalı/özet yönetici RPC'leri (1.000 satır kesilmesi biter)
--  5) Servis kaydı düzeltme geçmişi okuma RPC'si
--  6) Merkezi hız sınırı: bakım kaydı yazma (DB tetikleyicisi, 429)
--  7) Sistem Sağlığı: app_events, backup_runs, admin_system_health()

---------------------------------------------------------------------------
-- 1) plate_key
---------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists plate_key text
  generated always as (upper(regexp_replace(coalesce(plate, ''), '[^A-Za-z0-9]', '', 'g'))) stored;

---------------------------------------------------------------------------
-- 2) Indexler (Aşama D + P1 ölçümü, bkz. master_plan/p1)
---------------------------------------------------------------------------
create index if not exists vehicles_owner_user_idx on public.vehicles (owner_user_id) where owner_user_id is not null;
create index if not exists vehicles_tenant_created_idx on public.vehicles (tenant_id, created_at desc, id desc);
drop index if exists public.idx_vehicles_tenant;            -- yeni (tenant_id, created_at, id) kapsıyor
create index if not exists vehicles_created_idx on public.vehicles (created_at desc, id desc);
create index if not exists maintenance_records_vehicle_date_idx on public.maintenance_records (vehicle_id, service_date desc);
drop index if exists public.idx_maintenance_vehicle;        -- yeni (vehicle_id, service_date) kapsıyor
create index if not exists maintenance_records_tenant_created_idx on public.maintenance_records (tenant_id, created_at desc) where tenant_id is not null;
create index if not exists maintenance_records_created_by_idx on public.maintenance_records (created_by, created_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_id, created_at);
create index if not exists audit_log_actor_idx on public.audit_log ((detail ->> 'actor_user_id'), created_at desc);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc, id desc);
create index if not exists qr_keys_created_idx on public.qr_keys (created_at desc, id desc);
create index if not exists product_batches_created_idx on public.product_batches (created_at desc, id desc);

---------------------------------------------------------------------------
-- 3) RLS: aynı mantık, sorgu başına tek değerlendirme
---------------------------------------------------------------------------
-- vehicles
drop policy if exists owner_select_own_vehicles on public.vehicles;
drop policy if exists owner_modify_own_vehicles on public.vehicles;
drop policy if exists staff_select_own_tenant_vehicles on public.vehicles;
drop policy if exists staff_modify_own_tenant_vehicles on public.vehicles;
create policy owner_select_own_vehicles on public.vehicles for select
  using (owner_user_id = (select auth.uid()));
create policy owner_modify_own_vehicles on public.vehicles for all
  using (owner_user_id = (select auth.uid()));
create policy staff_select_own_tenant_vehicles on public.vehicles for select
  using (tenant_id = any (array(select public.approved_staff_tenant_ids())));
create policy staff_modify_own_tenant_vehicles on public.vehicles for all
  using (tenant_id = any (array(select public.approved_staff_tenant_ids())))
  with check (tenant_id = any (array(select public.approved_staff_tenant_ids())));

-- maintenance_records
drop policy if exists owner_select_own_vehicle_records on public.maintenance_records;
drop policy if exists owner_insert_own_vehicle_records on public.maintenance_records;
drop policy if exists staff_select_own_tenant_records on public.maintenance_records;
drop policy if exists staff_modify_own_tenant_records on public.maintenance_records;
create policy owner_select_own_vehicle_records on public.maintenance_records for select
  using (vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid())));
create policy owner_insert_own_vehicle_records on public.maintenance_records for insert
  with check (vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid())) and tenant_id is null);
create policy staff_select_own_tenant_records on public.maintenance_records for select
  using (tenant_id = any (array(select public.approved_staff_tenant_ids())));
create policy staff_modify_own_tenant_records on public.maintenance_records for all
  using (tenant_id = any (array(select public.approved_staff_tenant_ids())))
  with check (tenant_id = any (array(select public.approved_staff_tenant_ids()))
              and vehicle_id in (select v.id from public.vehicles v
                                  where v.tenant_id = any (array(select public.approved_staff_tenant_ids()))));

-- maintenance_items
drop policy if exists owner_modify_own_vehicle_items on public.maintenance_items;
drop policy if exists owner_select_own_vehicle_items on public.maintenance_items;
drop policy if exists staff_modify_own_tenant_items on public.maintenance_items;
drop policy if exists staff_select_own_tenant_items on public.maintenance_items;
create policy owner_select_own_vehicle_items on public.maintenance_items for select
  using (vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid())));
create policy owner_modify_own_vehicle_items on public.maintenance_items for all
  using (vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid())));
create policy staff_select_own_tenant_items on public.maintenance_items for select
  using (vehicle_id in (select v.id from public.vehicles v
                         where v.tenant_id = any (array(select public.approved_staff_tenant_ids()))));
create policy staff_modify_own_tenant_items on public.maintenance_items for all
  using (vehicle_id in (select v.id from public.vehicles v
                         where v.tenant_id = any (array(select public.approved_staff_tenant_ids()))))
  with check (vehicle_id in (select v.id from public.vehicles v
                              where v.tenant_id = any (array(select public.approved_staff_tenant_ids()))));

-- qr_keys (yalnız okuma politikaları; yazma zaten RPC/sunucu)
drop policy if exists owner_select_own_vehicle_qr_keys on public.qr_keys;
drop policy if exists staff_select_own_tenant_qr_keys on public.qr_keys;
create policy owner_select_own_vehicle_qr_keys on public.qr_keys for select to authenticated
  using (vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid())));
create policy staff_select_own_tenant_qr_keys on public.qr_keys for select to authenticated
  using (vehicle_id in (select v.id from public.vehicles v
                         where v.tenant_id = any (array(select public.approved_staff_tenant_ids()))));

-- audit_log
drop policy if exists owner_select_own_audit_log on public.audit_log;
drop policy if exists staff_own_tenant_audit_log on public.audit_log;
create policy owner_select_own_audit_log on public.audit_log for select to authenticated
  using ((detail ->> 'actor_user_id') = (select auth.uid())::text);
create policy staff_own_tenant_audit_log on public.audit_log for select
  using (tenant_id in (select s.tenant_id from public.staff_users s where s.id = (select auth.uid())));

-- staff_users / tenants
drop policy if exists staff_select_own_row on public.staff_users;
create policy staff_select_own_row on public.staff_users for select using (id = (select auth.uid()));
drop policy if exists tenants_select_own on public.tenants;
drop policy if exists tenants_update_own_by_owner on public.tenants;
create policy tenants_select_own on public.tenants for select
  using (id in (select s.tenant_id from public.staff_users s where s.id = (select auth.uid())));
create policy tenants_update_own_by_owner on public.tenants for update to authenticated
  using (id in (select s.tenant_id from public.staff_users s where s.id = (select auth.uid()) and s.role = 'owner'))
  with check (id in (select s.tenant_id from public.staff_users s where s.id = (select auth.uid()) and s.role = 'owner'));

-- customers / kvkk / silme talepleri
drop policy if exists staff_select_own_tenant_customers on public.customers;
create policy staff_select_own_tenant_customers on public.customers for all
  using (tenant_id = any (array(select public.approved_staff_tenant_ids())))
  with check (tenant_id = any (array(select public.approved_staff_tenant_ids())));
drop policy if exists staff_own_tenant_consents on public.kvkk_consents;
create policy staff_own_tenant_consents on public.kvkk_consents for all
  using (tenant_id in (select s.tenant_id from public.staff_users s where s.id = (select auth.uid())));
drop policy if exists staff_own_tenant_deletion_requests on public.data_deletion_requests;
create policy staff_own_tenant_deletion_requests on public.data_deletion_requests for all
  using (tenant_id in (select s.tenant_id from public.staff_users s where s.id = (select auth.uid())));

---------------------------------------------------------------------------
-- 6) Merkezi hız sınırı — veritabanında (sunucusuz uyumlu, işlem belleği yok)
---------------------------------------------------------------------------
-- İç yardımcı: sınır aşılırsa PostgREST'e HTTP 429 döndürür.
create or replace function public.enforce_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.rate_limit_hit(p_key, p_window_seconds, p_max) then
    raise sqlstate 'PGRST' using
      message = json_build_object('code', 'rate_limited',
                                  'message', 'Çok fazla işlem yapıldı. Lütfen biraz sonra tekrar deneyin.')::text,
      detail = json_build_object('status', 429, 'headers', json_build_object('Retry-After', p_window_seconds::text))::text;
  end if;
end;
$$;
revoke all on function public.enforce_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.enforce_rate_limit(text, integer, integer) to service_role;

-- Bakım kaydı oluşturma/düzeltme: istemciden gelen her yazma kullanıcı başına sayılır
-- (record_service_visit RPC'si ve doğrudan tablo yazması aynı kapıdan geçer).
create or replace function public.rate_limit_maintenance_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is not null
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    perform public.enforce_rate_limit('u:' || v_uid || ':mr:5m', 300, 40);
    perform public.enforce_rate_limit('u:' || v_uid || ':mr:1d', 86400, 400);
  end if;
  return new;
end;
$$;
revoke all on function public.rate_limit_maintenance_write() from public, anon, authenticated;
drop trigger if exists trg_rate_limit_maintenance_write on public.maintenance_records;
create trigger trg_rate_limit_maintenance_write
  before insert or update on public.maintenance_records
  for each statement execute function public.rate_limit_maintenance_write();

---------------------------------------------------------------------------
-- 7a) Uygulama olayları (Sistem Sağlığı kaynağı) — kişisel veri YOK, 30 gün
---------------------------------------------------------------------------
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind ~ '^[a-z0-9_]{2,40}$'),
  route text check (length(route) <= 80),
  status integer,
  detail jsonb check (detail is null or pg_column_size(detail) <= 2000)
);
create index if not exists app_events_kind_created_idx on public.app_events (kind, created_at desc);
alter table public.app_events enable row level security;
revoke all on public.app_events from public, anon, authenticated;
grant select, insert, delete on public.app_events to service_role;

create or replace function public.log_app_event(p_kind text, p_route text default null, p_status integer default null, p_detail jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_events (kind, route, status, detail)
  values (p_kind, left(p_route, 80), p_status, p_detail);
  if random() < 0.01 then
    delete from public.app_events where created_at < now() - interval '30 days';
  end if;
end;
$$;
revoke all on function public.log_app_event(text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.log_app_event(text, text, integer, jsonb) to service_role;

---------------------------------------------------------------------------
-- 7b) Yedek kayıtları (Free plan: elle/dış yedek; her yedek buraya işlenir)
---------------------------------------------------------------------------
create table if not exists public.backup_runs (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null,
  kind text not null check (kind in ('pre_migration', 'pre_deploy', 'periodic', 'manual', 'restore_test')),
  ok boolean not null,
  location text check (length(location) <= 200),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  note text check (length(note) <= 300),
  created_at timestamptz not null default now()
);
alter table public.backup_runs enable row level security;
revoke all on public.backup_runs from public, anon, authenticated;
grant select, insert on public.backup_runs to service_role;

---------------------------------------------------------------------------
-- 4) Yönetici özet / sayfalı RPC'leri — yalnız service_role (API requireAdmin arkasında)
---------------------------------------------------------------------------
create or replace function public.admin_overview_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with v as (select count(*) total, count(*) filter (where tenant_id is null) ind from public.vehicles),
       r as (select count(*) total, count(*) filter (where tenant_id is not null) svc from public.maintenance_records),
       q as (select count(*) total,
                    count(*) filter (where vehicle_id is not null and revoked_at is null) assigned,
                    count(*) filter (where vehicle_id is null and reserved_tenant_id is not null and revoked_at is null) reserved_free,
                    count(*) filter (where vehicle_id is null and reserved_user_id is not null and revoked_at is null) reserved_user,
                    count(*) filter (where vehicle_id is null and reserved_tenant_id is null and reserved_user_id is null and revoked_at is null) free,
                    count(*) filter (where revoked_at is not null) revoked
             from public.qr_keys),
       u as (select count(*) total,
                    count(*) filter (where last_sign_in_at > now() - interval '7 days') a7,
                    count(*) filter (where last_sign_in_at > now() - interval '30 days') a30
             from auth.users),
       tv as (select tenant_id, count(*) n from public.vehicles where tenant_id is not null group by tenant_id),
       tr as (select tenant_id, count(*) n from public.maintenance_records where tenant_id is not null group by tenant_id),
       ts as (select tenant_id, count(*) n from public.staff_users group by tenant_id),
       tq as (select reserved_tenant_id tenant_id, count(*) n from public.qr_keys
               where reserved_tenant_id is not null and vehicle_id is null and revoked_at is null group by reserved_tenant_id)
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'users', u.total, 'active_users_7d', u.a7, 'active_users_30d', u.a30,
      'tenants', (select count(*) from public.tenants), 'staff', (select count(*) from public.staff_users),
      'vehicles', v.total, 'vehicles_individual', v.ind, 'vehicles_service', v.total - v.ind,
      'records', r.total, 'records_service', r.svc, 'records_owner', r.total - r.svc,
      'qr_total', q.total, 'qr_assigned', q.assigned, 'qr_reserved_free', q.reserved_free,
      'qr_reserved_user', q.reserved_user, 'qr_free', q.free, 'qr_revoked', q.revoked),
    'tenants', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'phone', t.phone, 'is_active', t.is_active,
        'approval_status', t.approval_status, 'created_at', t.created_at,
        'vehicles', coalesce(tv.n, 0), 'records', coalesce(tr.n, 0), 'staff', coalesce(ts.n, 0),
        'qr_reserved_free', coalesce(tq.n, 0)) order by t.created_at)
      from public.tenants t
      left join tv on tv.tenant_id = t.id left join tr on tr.tenant_id = t.id
      left join ts on ts.tenant_id = t.id left join tq on tq.tenant_id = t.id), '[]'::jsonb),
    'recent_records', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select m.id, veh.plate, coalesce(tn.name, case when m.tenant_id is null then 'Araç sahibi' else 'Servis' end) source,
               m.tenant_id is null as by_owner, au.email created_by_email, m.created_at, m.service_date, m.km_at_service, m.description
        from public.maintenance_records m
        left join public.vehicles veh on veh.id = m.vehicle_id
        left join public.tenants tn on tn.id = m.tenant_id
        left join auth.users au on au.id = m.created_by
        order by m.created_at desc limit 25) x), '[]'::jsonb))
  from v, r, q, u;
$$;

-- Kullanıcılar: e-posta araması + (created_at, id) cursor, sayfa en çok 100.
create or replace function public.admin_users_page(
  p_search text default null, p_cursor_created timestamptz default null, p_cursor_id uuid default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_q text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_rows jsonb;
  v_total bigint;
begin
  select count(*) into v_total from auth.users u where v_q is null or lower(u.email) like '%' || v_q || '%';
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows from (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null email_confirmed,
           case when pa.user_id is not null then 'yonetici' when s.id is not null then 'servis' else 'bireysel' end as type,
           tn.name tenant_name, s.role staff_role,
           case when s.id is not null then (select count(*) from public.vehicles v where v.tenant_id = s.tenant_id)
                else (select count(*) from public.vehicles v where v.owner_user_id = u.id) end vehicles,
           (select count(*) from public.maintenance_records m where m.created_by = u.id) records_created,
           (select max(m.created_at) from public.maintenance_records m where m.created_by = u.id) last_record_at
    from auth.users u
    left join public.platform_admins pa on pa.user_id = u.id
    left join public.staff_users s on s.id = u.id
    left join public.tenants tn on tn.id = s.tenant_id
    where (v_q is null or lower(u.email) like '%' || v_q || '%')
      and (p_cursor_created is null or (u.created_at, u.id) < (p_cursor_created, p_cursor_id))
    order by u.created_at desc, u.id desc
    limit v_lim + 1) x;
  return jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(v_rows) with ordinality t(e, i) where i <= v_lim) z),
    'has_more', jsonb_array_length(v_rows) > v_lim,
    'total', v_total,
    'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'));
end;
$$;

-- id listesi → e-posta (yönetim ekranlarında kullanıcı başına ayrı Auth çağrısı yerine)
create or replace function public.admin_user_emails(p_ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text from auth.users u where u.id = any (p_ids[1:500]);
$$;

-- Parti özetleri: durum sayıları + seri aralığı + kanallar (ürün satırı istemciye gitmez)
create or replace function public.admin_batch_summaries(p_ids uuid[])
returns table (batch_id uuid, counts jsonb, serial_first text, serial_last text, channels text[])
language sql
stable
security definer
set search_path = ''
as $$
  select b.batch_id,
         (select jsonb_object_agg(s.status, s.n) from (select status, count(*) n from public.qr_keys q2 where q2.batch_id = b.batch_id group by status) s),
         min(q.serial_no), max(q.serial_no),
         array_remove(array_agg(distinct q.distribution_channel), null)
  from (select unnest(p_ids[1:200]) batch_id) b
  join public.qr_keys q on q.batch_id = b.batch_id
  group by b.batch_id;
$$;

create or replace function public.admin_qr_batch_labels()
returns table (batch_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct q.batch_label from public.qr_keys q where q.batch_label is not null order by 1 limit 500;
$$;

-- İşlem kaydı (audit) akışı: (created_at, id) cursor
create or replace function public.admin_audit_page(
  p_action text default null, p_cursor_created timestamptz default null, p_cursor_id uuid default null, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lim as (select least(greatest(coalesce(p_limit, 50), 1), 100) n),
  rows as (
    select a.id, a.created_at, a.action, a.target_table, a.target_id, a.tenant_id, t.name tenant_name,
           au.email actor_email, a.detail - 'old' - 'new' detail
    from public.audit_log a
    left join public.tenants t on t.id = a.tenant_id
    left join auth.users au on au.id::text = a.detail ->> 'actor_user_id'
    where (p_action is null or a.action = p_action)
      and (p_cursor_created is null or (a.created_at, a.id) < (p_cursor_created, p_cursor_id))
    order by a.created_at desc, a.id desc
    limit (select n + 1 from lim))
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id desc)
                      from (select * from rows order by created_at desc, id desc limit (select n from lim)) r), '[]'::jsonb),
    'has_more', (select count(*) from rows) > (select n from lim));
$$;

---------------------------------------------------------------------------
-- 5) Servis kaydı düzeltme geçmişi (salt okuma; silme/değiştirme yok)
---------------------------------------------------------------------------
-- Çağıran aracı görebiliyorsa (sahibi ya da onaylı servisi) o aracın kayıtlarının
-- revizyonlarını döndürür. Servis personeli değiştireni adıyla görür; araç
-- sahibi yalnız servis adını görür (personel e-postası/adı sahibe açılmaz).
create or replace function public.maintenance_record_history(p_vehicle_id uuid)
returns table (record_id uuid, revision integer, changed_at timestamptz, changed_by text, changed_fields jsonb, old_values jsonb, new_values jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_tenant uuid;
  v_staff_view boolean;
begin
  if v_uid is null then
    return;
  end if;
  select v.owner_user_id, v.tenant_id into v_owner, v_tenant from public.vehicles v where v.id = p_vehicle_id;
  if not found then
    return;
  end if;
  v_staff_view := v_tenant is not null and v_tenant = any (array(select public.approved_staff_tenant_ids()));
  if not v_staff_view and v_owner is distinct from v_uid then
    return;
  end if;
  return query
    select a.target_id, (a.detail ->> 'revision')::integer, a.created_at,
           case when v_staff_view then coalesce(nullif(s.full_name, ''), 'Servis personeli')
                else coalesce(t.name, 'Servis') end,
           a.detail -> 'changed_fields',
           (a.detail -> 'old') - array['id', 'vehicle_id', 'tenant_id', 'created_by', 'created_at', 'client_request_id'],
           (a.detail -> 'new') - array['id', 'vehicle_id', 'tenant_id', 'created_by', 'created_at', 'client_request_id']
    from public.maintenance_records m
    join public.audit_log a on a.target_id = m.id and a.action = 'maintenance_record_revised'
    left join public.staff_users s on s.id = a.actor_staff_id
    left join public.tenants t on t.id = a.tenant_id
    where m.vehicle_id = p_vehicle_id
    order by a.created_at desc
    limit 500;
end;
$$;
revoke all on function public.maintenance_record_history(uuid) from public, anon;
grant execute on function public.maintenance_record_history(uuid) to authenticated;

---------------------------------------------------------------------------
-- 7c) Sistem Sağlığı — yalnız ölçülebilen değerler; ölçülemeyen "measured=false"
---------------------------------------------------------------------------
create or replace function public.admin_system_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := '[]'::jsonb;
  n1 bigint; n2 bigint; n3 bigint; t1 timestamptz; sz numeric; st text; x jsonb;
  c_warn constant text := 'UYARI'; c_crit constant text := 'KRİTİK'; c_ok constant text := 'NORMAL';
begin
  -- 1) Giriş / kayıt hataları (uygulamanın gördüğü, 24 saat)
  select count(*) into n1 from public.app_events where kind in ('auth_error', 'login_failed', 'signup_error') and created_at > now() - interval '24 hours';
  st := case when n1 > 100 then c_crit when n1 >= 20 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'auth', 'label', 'Giriş / kayıt hataları (24 saat)', 'value', n1, 'status', st, 'measured', true,
    'detail', 'Yanlış şifre ve kayıt hataları. Tek tük hata normaldir.');

  -- 2) Aktivasyon hataları
  select count(*) filter (where not success), count(*) into n1, n2 from public.product_activation_attempts where created_at > now() - interval '24 hours';
  select count(*) into n3 from public.audit_log where action = 'product_activation_locked' and created_at > now() - interval '24 hours';
  st := case when n3 >= 5 or n1 > 100 then c_crit when n3 >= 1 or n1 >= 20 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'activation', 'label', 'Ürün etkinleştirme hataları (24 saat)', 'value', n1, 'status', st, 'measured', true,
    'detail', format('%s deneme, %s hatalı kod, %s kilitlenen ürün.', n2, n1, n3));

  -- 3) QR okutma (resolver) hataları
  select count(*) filter (where kind = 'resolver_error'), count(*) filter (where kind = 'resolver_rate_limited')
    into n1, n2 from public.app_events where kind in ('resolver_error', 'resolver_rate_limited') and created_at > now() - interval '24 hours';
  st := case when n1 > 5 then c_crit when n1 >= 1 or n2 >= 20 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'resolver', 'label', 'QR okutma hataları (24 saat)', 'value', n1, 'status', st, 'measured', true,
    'detail', format('%s sistem hatası, %s engellenen şüpheli tarama.', n1, n2));

  -- 4) Sunucu hataları (API 5xx)
  select count(*), count(*) filter (where created_at > now() - interval '1 hour')
    into n1, n2 from public.app_events where kind = 'api_5xx' and created_at > now() - interval '24 hours';
  st := case when n1 > 20 or n2 >= 10 then c_crit when n1 >= 3 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'api5xx', 'label', 'Sunucu hataları (24 saat)', 'value', n1, 'status', st, 'measured', true,
    'detail', format('Son 1 saatte %s.', n2));

  -- 5) Yavaş sorgular (pg_stat_statements; yalnız uygulama rolleri — Supabase
  --    panelinin ve PostgREST'in (authenticator) katalog sorguları sayılmaz;
  --    ortalama > 200 ms, en az 5 çağrı)
  begin
    select count(*), coalesce(max(mean_exec_time), 0) into n1, sz
      from extensions.pg_stat_statements s
      join pg_catalog.pg_roles r on r.oid = s.userid
     where r.rolname in ('anon', 'authenticated', 'service_role')
       and s.calls >= 5 and s.mean_exec_time > 200;
    st := case when n1 > 3 or sz > 1000 then c_crit when n1 >= 1 then c_warn else c_ok end;
    v := v || jsonb_build_object('key', 'slow', 'label', 'Yavaş sorgular', 'value', n1, 'status', st, 'measured', true,
      'detail', case when n1 = 0 then 'Ortalaması 200 ms''yi aşan sorgu yok.' else format('En yavaş ortalama %s ms.', round(sz)) end);
  exception when others then
    v := v || jsonb_build_object('key', 'slow', 'label', 'Yavaş sorgular', 'value', null, 'status', null, 'measured', false, 'detail', 'Ölçülemedi.');
  end;

  -- 6) Veritabanı kullanımı (Free plan 500 MB)
  sz := pg_database_size(current_database()) / 1048576.0;
  st := case when sz > 400 then c_crit when sz > 250 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'db', 'label', 'Veritabanı kullanımı', 'value', round(sz), 'unit', 'MB', 'status', st, 'measured', true,
    'detail', format('%s MB / 500 MB (ücretsiz plan sınırı).', round(sz)));

  -- 7) Dosya depolama (Free plan 1 GB)
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) / 1048576.0 into sz from storage.objects o;
  st := case when sz > 800 then c_crit when sz > 500 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'storage', 'label', 'Dosya depolama', 'value', round(sz, 1), 'unit', 'MB', 'status', st, 'measured', true,
    'detail', format('%s MB / 1024 MB. Belge modülü henüz yok.', round(sz, 1)));

  -- 8) E-posta gönderim sorunları (uygulamanın aldığı gönderim hatası)
  select count(*) into n1 from public.app_events where kind = 'email_send_error' and created_at > now() - interval '24 hours';
  st := case when n1 > 3 then c_crit when n1 >= 1 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'email', 'label', 'E-posta gönderim sorunları (24 saat)', 'value', n1, 'status', st, 'measured', true,
    'detail', 'Kayıt/doğrulama e-postası gönderilemediğinde sayılır. Gelen kutusuna düşme (bounce/spam) bu ekrandan ölçülmez.');

  -- 9) Yedek durumu
  select max(taken_at) into t1 from public.backup_runs where ok;
  select count(*) into n1 from public.backup_runs where not ok and taken_at > coalesce(t1, '-infinity'::timestamptz);
  st := case when t1 is null or t1 < now() - interval '14 days' or n1 > 0 then c_crit
             when t1 < now() - interval '8 days' then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'backup', 'label', 'Yedek durumu', 'value', t1, 'unit', 'time', 'status', st, 'measured', true,
    'detail', case when t1 is null then 'Kayıtlı başarılı yedek yok.'
                   else format('Son başarılı yedek %s gün önce. Ücretsiz planda otomatik yedek yok; yedek elle/dış kopya ile alınır.',
                               floor(extract(epoch from now() - t1) / 86400)) end);

  -- 10) Son kritik hata zamanı
  select max(created_at) into t1 from public.app_events where kind in ('api_5xx', 'resolver_error', 'email_send_error');
  st := case when t1 > now() - interval '1 hour' then c_crit when t1 > now() - interval '24 hours' then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'last_error', 'label', 'Son kritik hata', 'value', t1, 'unit', 'time', 'status', st, 'measured', true,
    'detail', case when t1 is null then 'Son 30 günde kritik hata kaydı yok.' else 'Sunucu, QR veya e-posta hatası.' end);

  -- 11) Hız sınırı tetiklenmeleri (bilgi)
  select count(*) into n1 from public.app_events where kind in ('rate_limited', 'resolver_rate_limited') and created_at > now() - interval '24 hours';
  st := case when n1 > 200 then c_crit when n1 >= 50 then c_warn else c_ok end;
  v := v || jsonb_build_object('key', 'ratelimit', 'label', 'Engellenen aşırı istek (24 saat)', 'value', n1, 'status', st, 'measured', true,
    'detail', 'Kötüye kullanım koruması devreye girdiğinde sayılır.');

  return jsonb_build_object(
    'overall', case when v @> '[{"status":"KRİTİK"}]' then c_crit when v @> '[{"status":"UYARI"}]' then c_warn else c_ok end,
    'measured_at', now(), 'items', v,
    'not_measured', jsonb_build_array(
      'Site erişilebilirliği (uptime): dış izleme servisi bağlanmadı.',
      'E-posta teslim oranı (bounce/spam): Brevo istatistik anahtarı bağlanmadı.',
      'Vercel zaman aşımı gibi uygulamaya hiç ulaşmayan hatalar.'));
end;
$$;

revoke all on function public.admin_overview_counts() from public, anon, authenticated;
revoke all on function public.admin_users_page(text, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_user_emails(uuid[]) from public, anon, authenticated;
revoke all on function public.admin_batch_summaries(uuid[]) from public, anon, authenticated;
revoke all on function public.admin_qr_batch_labels() from public, anon, authenticated;
revoke all on function public.admin_audit_page(text, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_system_health() from public, anon, authenticated;
grant execute on function public.admin_overview_counts() to service_role;
grant execute on function public.admin_users_page(text, timestamptz, uuid, integer) to service_role;
grant execute on function public.admin_user_emails(uuid[]) to service_role;
grant execute on function public.admin_batch_summaries(uuid[]) to service_role;
grant execute on function public.admin_qr_batch_labels() to service_role;
grant execute on function public.admin_audit_page(text, timestamptz, uuid, integer) to service_role;
grant execute on function public.admin_system_health() to service_role;
