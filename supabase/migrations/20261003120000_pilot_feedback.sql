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
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.pilot_started_at desc nulls last), '[]'::jsonb) into v_rows
  from (
    with pilot_users as (
      -- Pilot = bu pilot batch'indeki QR'lardan biri kendisine rezerve/aktive
      -- edilmiş veya aracına bağlanmış auth kullanıcısı. Test/smoke hesapları
      -- bu batch ile ilişkili değilse pilot sayılmaz.
      select distinct coalesce(q.activated_by, v.owner_user_id, q.reserved_user_id, q.created_by) as user_id,
             q.id as qr_id, q.serial_no, q.status as qr_status, q.assigned_at, q.activated_by, q.reserved_user_id, q.revoked_at, q.created_by,
             v.id as vehicle_id, v.plate as vehicle_plate, v.created_at as vehicle_created_at, v.owner_user_id as vehicle_owner_id
      from public.qr_keys q
      left join public.vehicles v on v.id = q.vehicle_id
      where q.batch_id = 'e868a624-5ab8-4c16-81bb-642747fb667d'
    ),
    agg as (
      select user_id,
             min(coalesce(assigned_at, vehicle_created_at)) as pilot_started_at,
             count(distinct qr_id) as qr_count,
             bool_or(qr_status = 'activated') as has_activated,
             bool_or(revoked_at is not null) as has_revoked,
             string_agg(distinct serial_no, ', ' order by serial_no) as serial_nos,
             min(vehicle_plate) as first_plate,
             count(distinct vehicle_id) filter (where vehicle_id is not null) as vehicle_count
      from pilot_users
      where user_id is not null
      group by user_id
    )
    select u.id, u.email, u.created_at, u.last_sign_in_at,
      agg.pilot_started_at,
      case
        when agg.pilot_started_at is null then 'bekleniyor'
        when now() < agg.pilot_started_at + interval '7 days' then 'bekleniyor'
        when u.last_sign_in_at is not null and u.last_sign_in_at >= agg.pilot_started_at + interval '7 days' then 'evet'
        else 'hayir'
      end as returned_7d,
      agg.qr_count, agg.has_activated, agg.has_revoked, agg.serial_nos, agg.first_plate, agg.vehicle_count,
      coalesce(agg.vehicle_count, 0) as vehicle_count2,
      (select count(*) from public.maintenance_records m where m.created_by = u.id) as record_count,
      (select max(m.created_at) from public.maintenance_records m where m.created_by = u.id) as last_record_at,
      (select count(*) from public.vehicle_documents d where d.uploaded_by = u.id) as document_count,
      (select count(*) from public.buyer_shares b where b.created_by = u.id) as buyer_share_count,
      (select count(*) from public.pilot_feedback f where f.user_id = u.id) as feedback_count,
      (select count(*) from public.pilot_feedback f where f.user_id = u.id and f.status <> 'cozuldu') as feedback_open
    from agg
    join auth.users u on u.id = agg.user_id
    left join public.platform_admins pa on pa.user_id = u.id
    left join public.staff_users s on s.id = u.id
    where pa.user_id is null and s.id is null
  ) x;
  return jsonb_build_object('rows', v_rows);
end;
$$;
revoke all on function public.admin_pilot_board() from public, anon, authenticated;
grant execute on function public.admin_pilot_board() to service_role;
