-- OTOİZ — 2026-09-24 staging (ctltjunojlaanzurxpzy)
-- Yönetim paneli: platform yöneticileri + QR'ı servise ayırma.
--
-- platform_admins: yalnız service_role okur/yazar; anon/authenticated'a
-- hiçbir yetki yok (RLS açık, politika yok, grant yok). Yönetici ataması
-- yalnız veritabanından yapılır — uygulama içinden kimse kendini yönetici
-- yapamaz. Proje sahibinin hesabı bu tabloya ayrı bir veri adımıyla
-- eklenir (migration'a kullanıcı kimliği yazılmaz).

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

-- QR kodlarını bir servise ayırma + kim üretti
alter table public.qr_keys add column if not exists reserved_tenant_id uuid references public.tenants(id) on delete set null;
alter table public.qr_keys add column if not exists created_by uuid references auth.users(id) on delete set null;
create index if not exists qr_keys_reserved_tenant_idx on public.qr_keys(reserved_tenant_id) where reserved_tenant_id is not null;
create index if not exists qr_keys_vehicle_idx on public.qr_keys(vehicle_id) where vehicle_id is not null;

-- Bir araca aynı anda yalnız bir aktif QR
create unique index if not exists qr_keys_one_active_per_vehicle
  on public.qr_keys(vehicle_id) where vehicle_id is not null and revoked_at is null;
