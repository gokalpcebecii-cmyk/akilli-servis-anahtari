-- OTOİZ 04A-S — safe schema baseline
--
-- Bu dosya, Production (sbfsiwqxbsojcxdutnem) şemasının ayrı staging
-- projesine (ctltjunojlaanzurxpzy / akilli-servis-anahtari-staging)
-- salt-okunur olarak çıkarılan haliyle birebir uygulanan baseline'ın
-- kaydıdır. Beş ayrı mcp__Supabase__apply_migration çağrısıyla staging'e
-- uygulanmıştır; bu dosya repository'deki tek kayıttır ve Production'a
-- hiçbir zaman uygulanmamalıdır — Production zaten bu şemaya sahiptir.
--
-- Kapsam: extensions, tables, constraints, indexes, RLS, policies,
-- functions, triggers, grants. Gerçek/sahte veri veya Vercel ortam
-- değişikliği bu dosyanın kapsamı dışındadır.

-- ============================================================
-- 1) Extensions
-- ============================================================
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;

-- ============================================================
-- 2) Tables
-- ============================================================
create table public.tenants (
  id uuid not null default uuid_generate_v4(),
  name text not null,
  slug text not null,
  logo_url text,
  primary_color text default '#1E3A5F'::text,
  phone text,
  address text,
  is_active boolean default true,
  created_at timestamptz default now(),
  secondary_color text default '#F4F1EA'::text,
  website_url text,
  reminder_days_before integer default 14,
  reminder_km_before integer default 500
);

create table public.staff_users (
  id uuid not null,
  tenant_id uuid not null,
  full_name text,
  role text default 'staff'::text,
  created_at timestamptz default now()
);

create table public.customers (
  id uuid not null default uuid_generate_v4(),
  tenant_id uuid not null,
  full_name text,
  phone text,
  email text,
  created_at timestamptz default now()
);

create table public.vehicles (
  id uuid not null default uuid_generate_v4(),
  tenant_id uuid,
  customer_id uuid,
  plate text not null,
  brand text,
  model text,
  year integer,
  current_km integer default 0,
  next_service_km integer,
  next_service_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  vin text,
  batarya_degisim_tarihi date,
  lastik_degisim_km integer,
  lastik_degisim_tarihi date,
  silecek_degisim_tarihi date,
  fren_balata_km integer,
  fren_balata_tarihi date,
  muayene_tarihi date,
  trafik_sigortasi_bitis date,
  kasko_bitis date,
  motor_yagi_km integer,
  motor_yagi_tarihi date,
  yag_filtresi_km integer,
  yag_filtresi_tarihi date,
  hava_filtresi_km integer,
  hava_filtresi_tarihi date,
  polen_filtresi_km integer,
  polen_filtresi_tarihi date,
  triger_seti_km integer,
  triger_seti_tarihi date,
  owner_user_id uuid
);

create table public.maintenance_items (
  id uuid not null default gen_random_uuid(),
  vehicle_id uuid not null,
  item_key text not null,
  last_service_date date,
  last_service_km integer,
  interval_km integer,
  interval_months integer,
  created_at timestamptz default now()
);

create table public.maintenance_records (
  id uuid not null default uuid_generate_v4(),
  vehicle_id uuid not null,
  tenant_id uuid,
  service_date date not null default CURRENT_DATE,
  km_at_service integer,
  description text not null,
  cost numeric(10,2),
  created_by uuid,
  created_at timestamptz default now()
);

create table public.qr_keys (
  id uuid not null default gen_random_uuid(),
  code text not null,
  vehicle_id uuid,
  batch_label text,
  created_at timestamptz default now(),
  assigned_at timestamptz,
  revoked_at timestamptz
);

create table public.ownership_transfers (
  id uuid not null default uuid_generate_v4(),
  vehicle_id uuid not null,
  tenant_id uuid,
  previous_customer_snapshot jsonb,
  previous_customer_data_erased boolean default false,
  new_customer_id uuid,
  km_at_transfer integer,
  transfer_date date not null default CURRENT_DATE,
  performed_by uuid,
  created_at timestamptz default now(),
  previous_owner_user_id uuid,
  new_owner_user_id uuid,
  transfer_token text not null default (replace(gen_random_uuid()::text, '-'::text, ''::text) || replace(gen_random_uuid()::text, '-'::text, ''::text)),
  token_expires_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz
);

create table public.kvkk_consents (
  id uuid not null default uuid_generate_v4(),
  customer_id uuid not null,
  tenant_id uuid not null,
  purpose text not null default 'bakim_hatirlatma_ve_iletisim'::text,
  consent_text_version text not null default 'v1'::text,
  granted boolean not null default true,
  granted_at timestamptz default now(),
  revoked_at timestamptz
);

create table public.data_deletion_requests (
  id uuid not null default uuid_generate_v4(),
  customer_id uuid not null,
  tenant_id uuid not null,
  requested_at timestamptz default now(),
  status text default 'pending'::text,
  completed_at timestamptz,
  handled_by uuid
);

create table public.audit_log (
  id uuid not null default uuid_generate_v4(),
  tenant_id uuid,
  actor_staff_id uuid,
  action text not null,
  target_table text,
  target_id uuid,
  detail jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 3) Constraints (PK / UNIQUE / CHECK / FK) and additional indexes
-- ============================================================
alter table public.tenants add constraint tenants_pkey primary key (id);
alter table public.staff_users add constraint staff_users_pkey primary key (id);
alter table public.customers add constraint customers_pkey primary key (id);
alter table public.vehicles add constraint vehicles_pkey primary key (id);
alter table public.maintenance_items add constraint maintenance_items_pkey primary key (id);
alter table public.maintenance_records add constraint maintenance_records_pkey primary key (id);
alter table public.qr_keys add constraint qr_keys_pkey primary key (id);
alter table public.ownership_transfers add constraint ownership_transfers_pkey primary key (id);
alter table public.kvkk_consents add constraint kvkk_consents_pkey primary key (id);
alter table public.data_deletion_requests add constraint data_deletion_requests_pkey primary key (id);
alter table public.audit_log add constraint audit_log_pkey primary key (id);

alter table public.tenants add constraint tenants_slug_key unique (slug);
alter table public.maintenance_items add constraint maintenance_items_vehicle_id_item_key_key unique (vehicle_id, item_key);
alter table public.qr_keys add constraint qr_keys_code_key unique (code);
alter table public.ownership_transfers add constraint ownership_transfers_transfer_token_key unique (transfer_token);

alter table public.maintenance_items add constraint maintenance_items_item_key_check check (item_key = ANY (ARRAY['motor_yagi'::text, 'yag_filtresi'::text, 'hava_filtresi'::text, 'polen_filtresi'::text, 'fren_disk_balata'::text, 'triger_seti'::text, 'aku'::text, 'lastik'::text, 'fren_on_balata'::text, 'fren_arka_balata'::text]));

alter table public.staff_users add constraint staff_users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.staff_users add constraint staff_users_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.customers add constraint customers_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.vehicles add constraint vehicles_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.vehicles add constraint vehicles_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete set null;
alter table public.vehicles add constraint vehicles_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id);

alter table public.maintenance_items add constraint maintenance_items_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete cascade;

alter table public.maintenance_records add constraint maintenance_records_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete cascade;
alter table public.maintenance_records add constraint maintenance_records_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.maintenance_records add constraint maintenance_records_created_by_fkey foreign key (created_by) references auth.users(id);

alter table public.qr_keys add constraint qr_keys_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete set null;

alter table public.ownership_transfers add constraint ownership_transfers_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete cascade;
alter table public.ownership_transfers add constraint ownership_transfers_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.ownership_transfers add constraint ownership_transfers_new_customer_id_fkey foreign key (new_customer_id) references public.customers(id) on delete set null;
alter table public.ownership_transfers add constraint ownership_transfers_performed_by_fkey foreign key (performed_by) references public.staff_users(id);
alter table public.ownership_transfers add constraint ownership_transfers_previous_owner_user_id_fkey foreign key (previous_owner_user_id) references auth.users(id);
alter table public.ownership_transfers add constraint ownership_transfers_new_owner_user_id_fkey foreign key (new_owner_user_id) references auth.users(id);

alter table public.kvkk_consents add constraint kvkk_consents_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete cascade;
alter table public.kvkk_consents add constraint kvkk_consents_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.data_deletion_requests add constraint data_deletion_requests_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete cascade;
alter table public.data_deletion_requests add constraint data_deletion_requests_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.data_deletion_requests add constraint data_deletion_requests_handled_by_fkey foreign key (handled_by) references public.staff_users(id);

alter table public.audit_log add constraint audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.audit_log add constraint audit_log_actor_staff_id_fkey foreign key (actor_staff_id) references public.staff_users(id);

create index idx_audit_tenant on public.audit_log using btree (tenant_id, created_at desc);
create index idx_maintenance_vehicle on public.maintenance_records using btree (vehicle_id);
create index idx_transfers_vehicle on public.ownership_transfers using btree (vehicle_id);
create index idx_vehicles_plate on public.vehicles using btree (plate);
create index idx_vehicles_tenant on public.vehicles using btree (tenant_id);
create unique index idx_vehicles_vin on public.vehicles using btree (vin) where (vin is not null);

-- ============================================================
-- 4) RLS + policies (27 policy — Production ile birebir)
-- ============================================================
alter table public.audit_log enable row level security;
alter table public.customers enable row level security;
alter table public.data_deletion_requests enable row level security;
alter table public.kvkk_consents enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.ownership_transfers enable row level security;
alter table public.qr_keys enable row level security;
alter table public.staff_users enable row level security;
alter table public.tenants enable row level security;
alter table public.vehicles enable row level security;

create policy "owner_select_own_vehicle_audit_log" on public.audit_log
  as permissive for select to public
  using (((target_table = 'vehicles'::text) AND (target_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())))) OR ((detail ->> 'actor_user_id'::text) = (auth.uid())::text));

create policy "staff_own_tenant_audit_log" on public.audit_log
  as permissive for select to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "staff_select_own_tenant_customers" on public.customers
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "staff_own_tenant_deletion_requests" on public.data_deletion_requests
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "staff_own_tenant_consents" on public.kvkk_consents
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "Servis kendi işletmesinin bakım kalemlerini düzenleyebilir" on public.maintenance_items
  as permissive for all to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))));

create policy "Servis kendi işletmesinin bakım kalemlerini görebilir" on public.maintenance_items
  as permissive for select to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))));

create policy "owner_modify_own_vehicle_items" on public.maintenance_items
  as permissive for all to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "owner_select_own_vehicle_items" on public.maintenance_items
  as permissive for select to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "owner_insert_own_vehicle_records" on public.maintenance_records
  as permissive for insert to public
  with check (((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid()))) AND (tenant_id IS NULL)));

create policy "owner_select_own_vehicle_records" on public.maintenance_records
  as permissive for select to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "staff_modify_own_tenant_records" on public.maintenance_records
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))
  with check (((tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid()))) AND (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))))));

create policy "staff_select_own_tenant_records" on public.maintenance_records
  as permissive for select to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "owner_manage_own_vehicle_transfers" on public.ownership_transfers
  as permissive for all to public
  using (((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid()))) OR (previous_owner_user_id = auth.uid()) OR (new_owner_user_id = auth.uid())))
  with check (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "staff_own_tenant_transfers" on public.ownership_transfers
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "owner_insert_own_vehicle_qr_keys" on public.qr_keys
  as permissive for insert to authenticated
  with check (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "owner_select_own_vehicle_qr_keys" on public.qr_keys
  as permissive for select to authenticated
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "owner_update_own_vehicle_qr_keys" on public.qr_keys
  as permissive for update to authenticated
  using (((revoked_at IS NULL) AND (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())))))
  with check (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "staff_select_own_tenant_or_pool_qr_keys" on public.qr_keys
  as permissive for select to authenticated
  using (((vehicle_id IS NULL) OR (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))))));

create policy "staff_update_own_tenant_qr_keys" on public.qr_keys
  as permissive for update to authenticated
  using (((revoked_at IS NULL) AND ((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid()))))) OR (vehicle_id IS NULL))))
  with check (((revoked_at IS NULL) AND ((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid()))))) OR (vehicle_id IS NULL))));

create policy "staff_select_own_row" on public.staff_users
  as permissive for select to public
  using (id = auth.uid());

create policy "public_read_tenant_branding" on public.tenants
  as permissive for select to public
  using (true);

create policy "tenants_select_own" on public.tenants
  as permissive for select to public
  using (id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "owner_modify_own_vehicles" on public.vehicles
  as permissive for all to public
  using (owner_user_id = auth.uid());

create policy "owner_select_own_vehicles" on public.vehicles
  as permissive for select to public
  using (owner_user_id = auth.uid());

create policy "staff_modify_own_tenant_vehicles" on public.vehicles
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "staff_select_own_tenant_vehicles" on public.vehicles
  as permissive for select to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- ============================================================
-- 5) Functions (SECURITY DEFINER, search_path=public) + triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_ownership_transfer(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select * into v_row from ownership_transfers where transfer_token = p_token for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_row.cancelled_at is not null then
    raise exception 'cancelled';
  end if;
  if v_row.accepted_at is not null then
    raise exception 'already_accepted';
  end if;
  if v_row.token_expires_at is not null and v_row.token_expires_at < now() then
    raise exception 'expired';
  end if;
  if v_row.previous_owner_user_id = auth.uid() then
    raise exception 'cannot_accept_own_transfer';
  end if;

  update ownership_transfers set accepted_at = now(), new_owner_user_id = auth.uid() where id = v_row.id;
  update vehicles set owner_user_id = auth.uid()
    where id = v_row.vehicle_id and owner_user_id is null;

  return jsonb_build_object('ok', true, 'vehicle_id', v_row.vehicle_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_ownership_transfer(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select * into v_row from ownership_transfers where transfer_token = p_token for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_row.previous_owner_user_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;
  if v_row.accepted_at is not null then
    raise exception 'already_accepted';
  end if;
  if v_row.cancelled_at is not null then
    raise exception 'already_cancelled';
  end if;

  update ownership_transfers set cancelled_at = now() where id = v_row.id;
  update vehicles set owner_user_id = v_row.previous_owner_user_id
    where id = v_row.vehicle_id and owner_user_id is null;

  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_vehicle_passport(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_qr record;
  v_vehicle record;
  v_tenant record;
  v_records jsonb;
  v_items jsonb;
begin
  select code, vehicle_id, revoked_at into v_qr
  from qr_keys
  where code = p_code;

  if not found or v_qr.revoked_at is not null then
    return null;
  end if;

  if v_qr.vehicle_id is null then
    return jsonb_build_object('status', 'unassigned');
  end if;

  select id, plate, brand, model, current_km, tenant_id into v_vehicle
  from vehicles
  where id = v_qr.vehicle_id;

  if not found then
    return null;
  end if;

  select name, phone, address into v_tenant
  from tenants
  where id = v_vehicle.tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'description', description,
      'created_at', created_at,
      'km_at_service', km_at_service
    ) order by created_at desc), '[]'::jsonb)
  into v_records
  from maintenance_records
  where vehicle_id = v_vehicle.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'item_key', item_key,
      'last_service_date', last_service_date,
      'last_service_km', last_service_km,
      'interval_km', interval_km,
      'interval_months', interval_months
    )), '[]'::jsonb)
  into v_items
  from maintenance_items
  where vehicle_id = v_vehicle.id;

  return jsonb_build_object(
    'status', 'active',
    'vehicle', jsonb_build_object(
      'plate', v_vehicle.plate,
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
$function$
;

CREATE OR REPLACE FUNCTION public.initiate_ownership_transfer(p_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner uuid;
  v_token text;
  v_transfer_id uuid;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select owner_user_id into v_owner from vehicles where id = p_vehicle_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'forbidden';
  end if;

  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  v_expires := now() + interval '7 days';

  insert into ownership_transfers (vehicle_id, tenant_id, previous_owner_user_id, transfer_token, token_expires_at, performed_by)
  values (p_vehicle_id, null, auth.uid(), v_token, v_expires, null)
  returning id into v_transfer_id;

  update vehicles set owner_user_id = null where id = p_vehicle_id;

  return jsonb_build_object('transfer_id', v_transfer_id, 'token', v_token, 'expires_at', v_expires);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_my_pending_outgoing_transfers()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'transfer_token', t.transfer_token,
    'created_at', t.created_at,
    'token_expires_at', t.token_expires_at,
    'plate', v.plate,
    'brand', v.brand,
    'model', v.model
  ) order by t.created_at desc), '[]'::jsonb)
  into v_result
  from ownership_transfers t
  join vehicles v on v.id = t.vehicle_id
  where t.previous_owner_user_id = auth.uid()
    and t.accepted_at is null
    and t.cancelled_at is null;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_ownership_transfer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff_id uuid;
begin
  select id into v_staff_id from staff_users where id = auth.uid();
  insert into audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (
    new.tenant_id,
    v_staff_id,
    'ownership_transfer_initiated',
    'ownership_transfers',
    new.id,
    jsonb_build_object(
      'vehicle_id', new.vehicle_id,
      'previous_owner_user_id', new.previous_owner_user_id,
      'new_owner_user_id', new.new_owner_user_id,
      'new_customer_id', new.new_customer_id,
      'actor_user_id', auth.uid()
    )
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_qr_key_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff_id uuid;
  v_tenant_id uuid;
begin
  if new.vehicle_id is not null then
    select id into v_staff_id from staff_users where id = auth.uid();
    select tenant_id into v_tenant_id from vehicles where id = new.vehicle_id;
    insert into audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
    values (
      v_tenant_id,
      v_staff_id,
      'qr_key_assigned',
      'qr_keys',
      new.id,
      jsonb_build_object('vehicle_id', new.vehicle_id, 'actor_user_id', auth.uid())
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_qr_key_revoked()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff_id uuid;
  v_tenant_id uuid;
begin
  if old.revoked_at is null and new.revoked_at is not null then
    select id into v_staff_id from staff_users where id = auth.uid();
    select tenant_id into v_tenant_id from vehicles where id = new.vehicle_id;
    insert into audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
    values (
      v_tenant_id,
      v_staff_id,
      'qr_key_revoked',
      'qr_keys',
      new.id,
      jsonb_build_object('vehicle_id', new.vehicle_id, 'actor_user_id', auth.uid())
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_vehicle_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff_id uuid;
begin
  select id into v_staff_id from staff_users where id = auth.uid();
  insert into audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (
    new.tenant_id,
    v_staff_id,
    'vehicle_created',
    'vehicles',
    new.id,
    jsonb_build_object('plate', new.plate, 'owner_user_id', new.owner_user_id, 'actor_user_id', auth.uid())
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_ownership_transfer(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row record;
  v_vehicle record;
begin
  select * into v_row from ownership_transfers where transfer_token = p_token;
  if not found or v_row.cancelled_at is not null or v_row.accepted_at is not null then
    return null;
  end if;
  if v_row.token_expires_at is not null and v_row.token_expires_at < now() then
    return null;
  end if;

  select plate, brand, model, current_km into v_vehicle from vehicles where id = v_row.vehicle_id;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'plate', v_vehicle.plate,
    'brand', v_vehicle.brand,
    'model', v_vehicle.model,
    'current_km', v_vehicle.current_km,
    'expires_at', v_row.token_expires_at
  );
end;
$function$
;

CREATE TRIGGER trg_log_ownership_transfer AFTER INSERT ON public.ownership_transfers FOR EACH ROW EXECUTE FUNCTION log_ownership_transfer();
CREATE TRIGGER trg_log_qr_key_assigned AFTER INSERT ON public.qr_keys FOR EACH ROW EXECUTE FUNCTION log_qr_key_assigned();
CREATE TRIGGER trg_log_qr_key_revoked AFTER UPDATE ON public.qr_keys FOR EACH ROW EXECUTE FUNCTION log_qr_key_revoked();
CREATE TRIGGER trg_log_vehicle_created AFTER INSERT ON public.vehicles FOR EACH ROW EXECUTE FUNCTION log_vehicle_created();

-- ============================================================
-- 6) Grants (anon / authenticated / service_role — Production ile birebir)
-- ============================================================
grant delete, insert, references, select, trigger, truncate, update on public.audit_log to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.customers to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.data_deletion_requests to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.kvkk_consents to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.maintenance_items to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.maintenance_records to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.ownership_transfers to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.qr_keys to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.staff_users to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.vehicles to anon, authenticated, service_role;

-- tenants: Production'daki istisna — anon tablo düzeyinde SELECT almıyor
grant delete, insert, references, trigger, truncate, update on public.tenants to anon;
grant delete, insert, references, select, trigger, truncate, update on public.tenants to authenticated, service_role;

revoke all on function public.accept_ownership_transfer(text) from public;
grant execute on function public.accept_ownership_transfer(text) to authenticated, service_role;

revoke all on function public.cancel_ownership_transfer(text) from public;
grant execute on function public.cancel_ownership_transfer(text) to authenticated, service_role;

revoke all on function public.get_public_vehicle_passport(text) from public;
grant execute on function public.get_public_vehicle_passport(text) to anon, authenticated, service_role;

revoke all on function public.initiate_ownership_transfer(uuid) from public;
grant execute on function public.initiate_ownership_transfer(uuid) to authenticated, service_role;

revoke all on function public.list_my_pending_outgoing_transfers() from public;
grant execute on function public.list_my_pending_outgoing_transfers() to authenticated, service_role;

revoke all on function public.log_ownership_transfer() from public;
grant execute on function public.log_ownership_transfer() to service_role;

revoke all on function public.log_qr_key_assigned() from public;
grant execute on function public.log_qr_key_assigned() to service_role;

revoke all on function public.log_qr_key_revoked() from public;
grant execute on function public.log_qr_key_revoked() to service_role;

revoke all on function public.log_vehicle_created() from public;
grant execute on function public.log_vehicle_created() to service_role;

revoke all on function public.preview_ownership_transfer(text) from public;
grant execute on function public.preview_ownership_transfer(text) to anon, authenticated, service_role;
