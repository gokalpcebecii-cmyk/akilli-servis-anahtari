-- OTOİZ — Alıcı Raporu ("Alıcıya Göster"): süreli, iptal edilebilir,
-- salt-okunur buyer paylaşımları. Yeni şema, mevcut tablolara dokunulmaz.
--
-- Gizlilik modeli: buyer_shares yalnız teknik geçmişe güvenli kısa bağlantı
-- üretir. Private belgeler, kişisel notlar, eski sahibin verileri asla
-- bu yolla açılmaz. Plain token DB'de SAKLANMAZ — yalnız sha256 özeti.

create table if not exists public.buyer_shares (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  duration_hours integer not null check (duration_hours in (24, 72, 168)),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  version integer not null default 1
);

create index if not exists buyer_shares_vehicle_idx on public.buyer_shares (vehicle_id);

alter table public.buyer_shares enable row level security;

-- Yalnız araç sahibi kendi paylaşımlarını yönetir (select/insert/update).
revoke all on table public.buyer_shares from public, anon, authenticated;
grant select, insert, update on table public.buyer_shares to authenticated;

drop policy if exists owner_manage_own_buyer_shares on public.buyer_shares;
create policy owner_manage_own_buyer_shares on public.buyer_shares
  for all to authenticated
  using (
    vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid()))
    and created_by = (select auth.uid())
  )
  with check (
    vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid()))
    and created_by = (select auth.uid())
  );

grant all on table public.buyer_shares to service_role;
