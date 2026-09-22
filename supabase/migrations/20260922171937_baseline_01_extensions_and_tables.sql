-- OTOİZ 04A-S — safe schema baseline, part 1/5
-- Staging ONLY (ctltjunojlaanzurxpzy / akilli-servis-anahtari-staging).
-- Applied verbatim via mcp__Supabase__apply_migration; version/name here
-- match the staging migration ledger exactly (list_migrations). Never
-- apply to Production — Production already has this schema.

-- Extensions (matches Production sbfsiwqxbsojcxdutnem actually-installed set)
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;

-- Tables (column order, defaults, nullability verbatim from Production)

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
