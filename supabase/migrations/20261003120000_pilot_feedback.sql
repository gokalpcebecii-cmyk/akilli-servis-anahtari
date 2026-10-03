-- OTOİZ — Geri Bildirim V2 (pilot bloker fix): /bireysel/gorus artık
-- audit_log yerine pilot_feedback tablosuna yazar; screenshot_path ve
-- durum (status) taşır. Eski audit_log kayıtları korunur (hiç dokunulmaz).

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('hata','istek','kullanim_zorlugu','diger')),
  screen text not null,
  message text not null check (char_length(message) between 5 and 1000),
  screenshot_path text,
  status text not null default 'yeni' check (status in ('yeni','inceleniyor','cozuldu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pilot_feedback_user_created_idx on public.pilot_feedback (user_id, created_at desc);
create index if not exists pilot_feedback_status_idx on public.pilot_feedback (status, created_at desc);

alter table public.pilot_feedback enable row level security;
revoke all on table public.pilot_feedback from public, anon, authenticated;
grant select, insert on table public.pilot_feedback to authenticated;
grant all on table public.pilot_feedback to service_role;

-- Kullanıcı yalnız kendi feedback'ini görür ve oluşturur.
drop policy if exists feedback_owner_select on public.pilot_feedback;
create policy feedback_owner_select on public.pilot_feedback
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists feedback_owner_insert on public.pilot_feedback;
create policy feedback_owner_insert on public.pilot_feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'yeni');

-- Durum yalnız service_role (admin API) ile değişir.
drop policy if exists feedback_owner_update on public.pilot_feedback;

-- Özel depolama kovası: ekran görüntüleri.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pilot-feedback', 'pilot-feedback', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Dosya yolu "<user_id>/<uuid>.<ext>": yalnız kendi klasörü.
drop policy if exists otoiz_feedback_insert on storage.objects;
create policy otoiz_feedback_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pilot-feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists otoiz_feedback_select on storage.objects;
create policy otoiz_feedback_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pilot-feedback'
    and owner_id = (select auth.uid())::text
  );

-- Pilot Kontrol Merkezi: tek SQL ile kullanıcı başına pilot durumu.
-- Yalnız service_role (admin API arkasında).
create or replace function public.admin_pilot_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb) into v_rows
  from (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
      (u.last_sign_in_at > now() - interval '7 days') as returned_7d,
      (select count(*) from public.vehicles v where v.owner_user_id = u.id) as vehicle_count,
      (select v.plate from public.vehicles v where v.owner_user_id = u.id order by v.created_at asc limit 1) as first_plate,
      (select count(*) from public.maintenance_records m where m.created_by = u.id) as record_count,
      (select max(m.created_at) from public.maintenance_records m where m.created_by = u.id) as last_record_at,
      (select count(*) from public.vehicle_documents d where d.uploaded_by = u.id) as document_count,
      (select count(*) from public.buyer_shares b where b.created_by = u.id) as buyer_share_count,
      (select count(*) from public.pilot_feedback f where f.user_id = u.id) as feedback_count,
      (select count(*) from public.pilot_feedback f where f.user_id = u.id and f.status <> 'cozuldu') as feedback_open,
      (select count(*) from public.qr_keys q where q.assigned_at is not null and q.revoked_at is null and q.vehicle_id is not null
        and q.vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = u.id)) as qr_active,
      (select count(*) from public.qr_keys q where q.activated_by = u.id) as qr_activated_by,
      (select q.serial_no from public.qr_keys q where q.activated_by = u.id order by q.assigned_at desc limit 1) as last_serial_no
    from auth.users u
    left join public.platform_admins pa on pa.user_id = u.id
    left join public.staff_users s on s.id = u.id
    where pa.user_id is null and s.id is null
  ) x;
  return jsonb_build_object('rows', v_rows);
end;
$$;
revoke all on function public.admin_pilot_board() from public, anon, authenticated;
grant execute on function public.admin_pilot_board() to service_role;
