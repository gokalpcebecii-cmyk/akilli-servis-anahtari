-- OTOİZ — KVKK aydınlatma / Kullanım Koşulları kayıtları.
-- Aydınlatma metni "consent" değildir; bilgi edinme kaydı ayrı tutulur.

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('kvkk_aydinlatma', 'kullanim_kosullari')),
  document_version text not null,
  acknowledged_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, document_type, document_version)
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id, created_at desc);

alter table public.legal_acceptances enable row level security;

revoke all on table public.legal_acceptances from public, anon, authenticated;
grant select on table public.legal_acceptances to authenticated;

drop policy if exists legal_acceptances_select_own on public.legal_acceptances;
create policy legal_acceptances_select_own on public.legal_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()));

grant all on table public.legal_acceptances to service_role;
