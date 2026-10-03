-- OTOİZ — Hızlı İşlem Alanı > "Belge Ekle" (fatura, servis fişi, muayene /
-- sigorta / kasko belgesi). Mevcut tablolara dokunulmaz; yalnız yeni bir
-- belge tablosu + özel (public olmayan) depolama kovası eklenir.
--
-- Gizlilik: belge yalnız onu yükleyen kişiye, o kişi aracın GÜNCEL sahibi
-- olduğu sürece görünür. Araç devredilirse eski sahibin faturaları yeni
-- sahibe açılmaz (kişisel bilgi içerebilir); servis personeli görmez.

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('fatura', 'servis_fisi', 'muayene', 'sigorta', 'kasko', 'diger')),
  doc_date date,
  note text check (note is null or char_length(note) <= 200),
  storage_path text not null unique check (storage_path like vehicle_id::text || '/%'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);
create index if not exists vehicle_documents_vehicle_created_idx on public.vehicle_documents (vehicle_id, created_at desc);

alter table public.vehicle_documents enable row level security;

drop policy if exists owner_select_own_documents on public.vehicle_documents;
create policy owner_select_own_documents on public.vehicle_documents
  for select to authenticated
  using (
    uploaded_by = (select auth.uid())
    and vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid()))
  );

drop policy if exists owner_insert_own_documents on public.vehicle_documents;
create policy owner_insert_own_documents on public.vehicle_documents
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid()))
  );

revoke all on table public.vehicle_documents from public, anon, authenticated;
grant select, insert on table public.vehicle_documents to authenticated;
grant all on table public.vehicle_documents to service_role;

-- Kötüye kullanım sınırı (bakım kaydıyla aynı kapı): kullanıcı başına
-- 10 dakikada 20, günde 100 belge.
create or replace function public.rate_limit_document_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is not null
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    perform public.enforce_rate_limit('u:' || v_uid || ':doc:10m', 600, 20);
    perform public.enforce_rate_limit('u:' || v_uid || ':doc:1d', 86400, 100);
  end if;
  return new;
end;
$$;
revoke all on function public.rate_limit_document_write() from public, anon, authenticated;
drop trigger if exists trg_rate_limit_document_write on public.vehicle_documents;
create trigger trg_rate_limit_document_write
  before insert on public.vehicle_documents
  for each statement execute function public.rate_limit_document_write();

-- Özel depolama kovası: herkese açık bağlantı yok; dosya yalnız kısa ömürlü
-- imzalı bağlantıyla açılır. 10 MB, yalnız PDF ve fotoğraf.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-documents', 'vehicle-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Dosya yolu "<araç id>/<rastgele id>.<uzantı>": yükleme yalnız kendi
-- aracının klasörüne; okuma yalnız kendi yüklediği ve hâlâ sahibi olduğu
-- aracın dosyası. Güncelleme/silme politikası yok (üzerine yazılamaz).
drop policy if exists otoiz_vehicle_documents_insert on storage.objects;
create policy otoiz_vehicle_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-documents'
    and (storage.foldername(name))[1] in (select v.id::text from public.vehicles v where v.owner_user_id = (select auth.uid()))
  );

drop policy if exists otoiz_vehicle_documents_select on storage.objects;
create policy otoiz_vehicle_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] in (select v.id::text from public.vehicles v where v.owner_user_id = (select auth.uid()))
  );
