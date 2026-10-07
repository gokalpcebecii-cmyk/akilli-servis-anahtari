-- OTOİZ — Sahiplik devrinde SEÇİMLİ belge aktarımı (E–H).
--
-- Not: Bu dosyanın önceki yerel taslağı (commit 07f1bd5) hiçbir uzak
-- ortama (staging/prod) uygulanmamıştı ve depoya hiç gönderilmemişti; dosya
-- aynı adla, baştan ve denetlenerek yeniden yazıldı.
--
-- Kurallar:
-- * Bakım/servis geçmişi vehicle_id ile araçla birlikte devam eder (değişmez).
-- * Kişisel belgeler/faturalar OTOMATİK devredilmez. Eski sahip devri
--   başlatırken hangi belgeleri aktaracağını seçer; varsayılan seçim sıfırdır.
-- * Seçim ownership_transfer_documents tablosunda (transfer_id, document_id
--   UNIQUE) saklanır. Belge ile devir aynı araca ait olmak ZORUNDADIR
--   (bileşik yabancı anahtar).
-- * Yeni sahip yalnız ACCEPTED devirde açıkça seçilmiş belgeleri görür.
--   PENDING / REJECTED / CANCELLED / EXPIRED devirde alıcının hiçbir belge
--   hakkı yoktur.
-- * Eski sahibin kendi belgelerine erişimi devir sonuçlanana kadar
--   (bekleyen, süresi dolmuş ama iptal edilmemiş devir dahil) DEĞİŞMEZ;
--   iptal/ret sonrası araç ve belgeler geri gelir; kabulden sonra mevcut
--   modelde olduğu gibi araç ve belge erişimi sona erer.
-- * Erişim üç katmanda aynı fonksiyonla denetlenir: vehicle_documents RLS,
--   belge API'si (/api/belgeler, kullanıcının JWT'siyle RLS'den okur) ve
--   imzalı bağlantı (/api/belgeler/baglanti: önce RLS'den okur, ancak
--   satır görünürse sunucuda 15 dakikalık imzalı URL üretir).
-- * Depolama kovası public DEĞİL; storage.objects politikaları
--   GENİŞLETİLMEZ — dosya yolunu bilmek erişim sağlamaz.

---------------------------------------------------------------------------
-- 1) Devir durumu: REJECT
---------------------------------------------------------------------------
alter table public.ownership_transfers add column if not exists rejected_at timestamptz;

-- Bileşik yabancı anahtarlar için hedef benzersizlikleri.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ownership_transfers_id_vehicle_key') then
    alter table public.ownership_transfers add constraint ownership_transfers_id_vehicle_key unique (id, vehicle_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vehicle_documents_id_vehicle_key') then
    alter table public.vehicle_documents add constraint vehicle_documents_id_vehicle_key unique (id, vehicle_id);
  end if;
end $$;

---------------------------------------------------------------------------
-- 2) Seçilen belgeler
---------------------------------------------------------------------------
create table if not exists public.ownership_transfer_documents (
  transfer_id uuid not null,
  document_id uuid not null,
  vehicle_id uuid not null,
  created_at timestamptz not null default now(),
  constraint ownership_transfer_documents_pkey primary key (transfer_id, document_id),
  constraint ownership_transfer_documents_transfer_fkey foreign key (transfer_id, vehicle_id)
    references public.ownership_transfers (id, vehicle_id) on delete cascade,
  constraint ownership_transfer_documents_document_fkey foreign key (document_id, vehicle_id)
    references public.vehicle_documents (id, vehicle_id) on delete cascade
);
create index if not exists ownership_transfer_documents_document_idx
  on public.ownership_transfer_documents (document_id);

-- İstemciye tamamen kapalı: yazma/okuma yalnız aşağıdaki SECURITY DEFINER
-- fonksiyonlarla.
alter table public.ownership_transfer_documents enable row level security;
revoke all on table public.ownership_transfer_documents from public, anon, authenticated;
grant all on table public.ownership_transfer_documents to service_role;

---------------------------------------------------------------------------
-- 3) Erişim fonksiyonları (tek doğruluk kaynağı)
---------------------------------------------------------------------------
-- Kullanıcı aracı hâlâ elinde tutuyor mu: güncel sahip, ya da kendi
-- başlattığı ve henüz sonuçlanmamış (kabul/iptal/ret yok) bir devir var.
create or replace function public.otoiz_controls_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.vehicles v
             where v.id = p_vehicle_id and v.owner_user_id = auth.uid())
    or exists (select 1 from public.ownership_transfers t
                where t.vehicle_id = p_vehicle_id
                  and t.previous_owner_user_id = auth.uid()
                  and t.accepted_at is null and t.cancelled_at is null and t.rejected_at is null)
  );
$$;

-- Kullanıcı belgenin yetkili sahibi mi: kendisi yükledi, ya da belge bu
-- araçta KABUL EDİLMİŞ bir devirde kendisine açıkça aktarıldı.
create or replace function public.otoiz_holds_vehicle_document(p_document_id uuid, p_vehicle_id uuid, p_uploaded_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    p_uploaded_by = auth.uid()
    or exists (
      select 1
        from public.ownership_transfer_documents d
        join public.ownership_transfers t on t.id = d.transfer_id and t.vehicle_id = d.vehicle_id
       where d.document_id = p_document_id
         and d.vehicle_id = p_vehicle_id
         and t.new_owner_user_id = auth.uid()
         and t.accepted_at is not null
         and t.cancelled_at is null and t.rejected_at is null
    )
  );
$$;

create or replace function public.otoiz_can_read_vehicle_document(p_document_id uuid, p_vehicle_id uuid, p_uploaded_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.otoiz_holds_vehicle_document(p_document_id, p_vehicle_id, p_uploaded_by)
     and public.otoiz_controls_vehicle(p_vehicle_id);
$$;

revoke all on function public.otoiz_controls_vehicle(uuid) from public, anon;
revoke all on function public.otoiz_holds_vehicle_document(uuid, uuid, uuid) from public, anon;
revoke all on function public.otoiz_can_read_vehicle_document(uuid, uuid, uuid) from public, anon;
grant execute on function public.otoiz_controls_vehicle(uuid) to authenticated, service_role;
grant execute on function public.otoiz_holds_vehicle_document(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.otoiz_can_read_vehicle_document(uuid, uuid, uuid) to authenticated, service_role;

---------------------------------------------------------------------------
-- 4) vehicle_documents okuma politikası (1. katman)
---------------------------------------------------------------------------
-- Eski politika: yükleyen VE güncel sahip. Yeni politika bunun üst kümesi
-- değil, tam tanımı: (yükleyen veya kabul edilmiş devirde açıkça seçilen
-- alıcı) VE (güncel sahip veya sonuçlanmamış devrin başlatanı).
-- Ekleme/silme politikaları DEĞİŞMEZ (yalnız yükleyen + güncel sahip).
-- Politika yerinde değiştirilir (DROP yok; geri alınabilir).
alter policy owner_select_own_documents on public.vehicle_documents
  using (public.otoiz_can_read_vehicle_document(id, vehicle_id, uploaded_by));

---------------------------------------------------------------------------
-- 5) Devir fonksiyonları
---------------------------------------------------------------------------
-- initiate: seçilen belge kimlikleriyle. Eski tek parametreli sürüm SİLİNMEZ,
-- adı değiştirilip çağrıya kapatılır (aynı adla iki sürüm PostgREST'te
-- belirsizlik yaratır; geri dönüş gerekirse eski adına çevrilebilir).
-- p_document_ids varsayılanı boş dizi olduğu için eski çağrılar aynen
-- çalışır ve hiçbir belge aktarılmaz.
do $$ begin
  if to_regprocedure('public.initiate_ownership_transfer(uuid)') is not null then
    alter function public.initiate_ownership_transfer(uuid) rename to initiate_ownership_transfer_v1_retired;
  end if;
  if to_regprocedure('public.initiate_ownership_transfer_v1_retired(uuid)') is not null then
    revoke all on function public.initiate_ownership_transfer_v1_retired(uuid) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.initiate_ownership_transfer(p_vehicle_id uuid, p_document_ids uuid[] default '{}'::uuid[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_vehicle record;
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '72 hours';
  v_ids uuid[] := coalesce(p_document_ids, '{}'::uuid[]);
  v_requested int;
  v_valid int;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select id, owner_user_id, tenant_id, current_km into v_vehicle
    from public.vehicles where id = p_vehicle_id for update;
  if not found or v_vehicle.owner_user_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Seçilen her belge: (1) bu araca ait, (2) çağıran aracın güncel sahibi
  -- (yukarıda), (3) çağıranın belgeye mevcut yetkisi var (yükleyen ya da
  -- kabul edilmiş devirle almış), (4) başkasının belgesi değil. Tek bir
  -- geçersiz kimlik bile varsa devir HİÇ oluşturulmaz.
  if array_position(v_ids, null) is not null then
    raise exception 'invalid_document' using errcode = '42501';
  end if;
  select count(distinct x) into v_requested from unnest(v_ids) as x;
  if v_requested > 200 then
    raise exception 'too_many_documents' using errcode = '22023';
  end if;
  select count(*) into v_valid
    from public.vehicle_documents d
   where d.id = any (v_ids)
     and d.vehicle_id = p_vehicle_id
     and public.otoiz_holds_vehicle_document(d.id, d.vehicle_id, d.uploaded_by);
  if v_valid <> v_requested then
    raise exception 'invalid_document' using errcode = '42501';
  end if;

  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.ownership_transfers
    (vehicle_id, tenant_id, previous_owner_user_id, token_hash, transfer_token, token_expires_at, km_at_transfer)
  values
    (p_vehicle_id, null, v_uid, encode(extensions.digest(v_token, 'sha256'), 'hex'), null, v_expires, v_vehicle.current_km)
  returning id into v_id;

  insert into public.ownership_transfer_documents (transfer_id, document_id, vehicle_id)
  select v_id, x, p_vehicle_id from (select distinct unnest(v_ids) as x) s;

  update public.vehicles set owner_user_id = null, updated_at = now() where id = p_vehicle_id;

  return jsonb_build_object('transfer_id', v_id, 'token', v_token, 'expires_at', v_expires,
                            'document_count', v_requested);
end;
$function$;

create or replace function public.preview_ownership_transfer(p_token text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_row record;
  v_vehicle record;
begin
  if auth.uid() is null or p_token is null or length(p_token) < 40 then
    return null;
  end if;
  select * into v_row from public.ownership_transfers
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found or v_row.cancelled_at is not null or v_row.accepted_at is not null
     or v_row.rejected_at is not null or v_row.token_expires_at < now() then
    return null;
  end if;
  select plate, brand, model, year, current_km into v_vehicle from public.vehicles where id = v_row.vehicle_id;
  if not found then
    return null;
  end if;
  -- Alıcı kabulden önce yalnız SAYIYI görür; belge adı/içeriği görünmez.
  return jsonb_build_object(
    'plate', v_vehicle.plate, 'brand', v_vehicle.brand, 'model', v_vehicle.model,
    'year', v_vehicle.year, 'current_km', v_vehicle.current_km,
    'expires_at', v_row.token_expires_at,
    'own_transfer', v_row.previous_owner_user_id = auth.uid(),
    'document_count', (select count(*) from public.ownership_transfer_documents d where d.transfer_id = v_row.id)
  );
end;
$function$;

create or replace function public.accept_ownership_transfer(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_vehicle record;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 40 then
    raise exception 'not_found';
  end if;
  select * into v_row from public.ownership_transfers
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_row.cancelled_at is not null then
    raise exception 'cancelled';
  end if;
  if v_row.rejected_at is not null then
    raise exception 'rejected';
  end if;
  if v_row.accepted_at is not null then
    raise exception 'already_accepted';
  end if;
  if v_row.token_expires_at < now() then
    raise exception 'expired';
  end if;
  if v_row.previous_owner_user_id = v_uid then
    raise exception 'cannot_accept_own_transfer';
  end if;
  if exists (select 1 from public.staff_users where id = v_uid) then
    raise exception 'staff_account_cannot_own';
  end if;

  select id, owner_user_id, tenant_id into v_vehicle from public.vehicles where id = v_row.vehicle_id for update;
  if not found or v_vehicle.owner_user_id is not null then
    raise exception 'invalid_state';
  end if;

  update public.vehicles
     set owner_user_id = v_uid, notes = null, customer_id = null, updated_at = now()
   where id = v_row.vehicle_id;
  update public.qr_keys set reserved_user_id = null
   where vehicle_id = v_row.vehicle_id and revoked_at is null;
  update public.ownership_transfers
     set accepted_at = now(), new_owner_user_id = v_uid, token_hash = null
   where id = v_row.id;

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (v_vehicle.tenant_id, null, 'ownership_transfer_completed', 'ownership_transfers', v_row.id,
          jsonb_build_object('vehicle_id', v_row.vehicle_id, 'actor_user_id', v_uid, 'completed_at', now(),
                             'document_count', (select count(*) from public.ownership_transfer_documents d where d.transfer_id = v_row.id)));

  return jsonb_build_object('ok', true, 'vehicle_id', v_row.vehicle_id);
end;
$function$;

-- Alıcı devri REDDEDER: araç ve belgeler eski sahibe aynen döner.
create or replace function public.reject_ownership_transfer(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 40 then
    raise exception 'not_found';
  end if;
  select * into v_row from public.ownership_transfers
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_row.cancelled_at is not null then
    raise exception 'cancelled';
  end if;
  if v_row.rejected_at is not null then
    raise exception 'rejected';
  end if;
  if v_row.accepted_at is not null then
    raise exception 'already_accepted';
  end if;
  if v_row.previous_owner_user_id = v_uid then
    raise exception 'cannot_reject_own_transfer';
  end if;

  update public.ownership_transfers set rejected_at = now(), token_hash = null where id = v_row.id;
  update public.vehicles set owner_user_id = v_row.previous_owner_user_id, updated_at = now()
   where id = v_row.vehicle_id and owner_user_id is null;

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (null, null, 'ownership_transfer_rejected', 'ownership_transfers', v_row.id,
          jsonb_build_object('vehicle_id', v_row.vehicle_id, 'actor_user_id', v_uid));
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.cancel_ownership_transfer(p_transfer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into v_row from public.ownership_transfers where id = p_transfer_id for update;
  if not found or v_row.previous_owner_user_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.accepted_at is not null then
    raise exception 'already_accepted';
  end if;
  if v_row.cancelled_at is not null then
    raise exception 'already_cancelled';
  end if;
  if v_row.rejected_at is not null then
    raise exception 'already_rejected';
  end if;

  update public.ownership_transfers set cancelled_at = now(), token_hash = null where id = v_row.id;
  update public.vehicles set owner_user_id = v_uid, updated_at = now()
   where id = v_row.vehicle_id and owner_user_id is null;

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (null, null, 'ownership_transfer_cancelled', 'ownership_transfers', v_row.id,
          jsonb_build_object('vehicle_id', v_row.vehicle_id, 'actor_user_id', v_uid,
                             'expired', v_row.token_expires_at < now()));
  return jsonb_build_object('ok', true, 'vehicle_id', v_row.vehicle_id);
end;
$function$;

create or replace function public.list_my_pending_outgoing_transfers()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'transfer_id', t.id,
      'created_at', t.created_at,
      'token_expires_at', t.token_expires_at,
      'expired', t.token_expires_at < now(),
      'plate', v.plate, 'brand', v.brand, 'model', v.model,
      'document_count', (select count(*) from public.ownership_transfer_documents d where d.transfer_id = t.id)
    ) order by t.created_at desc), '[]'::jsonb)
  into v_result
  from public.ownership_transfers t
  join public.vehicles v on v.id = t.vehicle_id
  where t.previous_owner_user_id = auth.uid()
    and t.accepted_at is null and t.cancelled_at is null and t.rejected_at is null;
  return v_result;
end;
$function$;

revoke all on function public.initiate_ownership_transfer(uuid, uuid[]) from public, anon;
revoke all on function public.preview_ownership_transfer(text) from public, anon;
revoke all on function public.accept_ownership_transfer(text) from public, anon;
revoke all on function public.reject_ownership_transfer(text) from public, anon;
revoke all on function public.cancel_ownership_transfer(uuid) from public, anon;
revoke all on function public.list_my_pending_outgoing_transfers() from public, anon;
grant execute on function public.initiate_ownership_transfer(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.preview_ownership_transfer(text) to authenticated, service_role;
grant execute on function public.accept_ownership_transfer(text) to authenticated, service_role;
grant execute on function public.reject_ownership_transfer(text) to authenticated, service_role;
grant execute on function public.cancel_ownership_transfer(uuid) to authenticated, service_role;
grant execute on function public.list_my_pending_outgoing_transfers() to authenticated, service_role;
