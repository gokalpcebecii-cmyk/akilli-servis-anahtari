-- OTOİZ — Sahiplik devri v2 (pilotta açık).
-- * Devir jetonu yalnız veritabanında CSPRNG ile (gen_random_bytes, 256 bit)
--   üretilir; yalnız SHA-256 özeti saklanır, jeton kullanıcıya bir kez döner.
-- * Tek kullanımlık, 72 saat süreli; iptal/kullanılmış/süresi dolmuş jeton
--   yeniden kullanılamaz. Başlatan hesap kendi devrini kabul edemez; servis
--   personeli hesabı araç devralamaz.
-- * Eski sahibin erişimi devir başlatıldığı anda kesilir (owner_user_id=null);
--   iptal edilirse (süre dolduktan sonra da) geri verilir.
-- * Kabulde vehicle_id değişmez, bakım geçmişi korunur; eski sahibin kişisel
--   alanları (notes, customer_id) temizlenir, QR aktif kalır ve kişiye
--   ayrılmışlık bilgisi silinir.
-- * ownership_transfers tablosuna istemci erişimi tamamen kapalıdır; tüm
--   işlemler aşağıdaki RPC'lerle yapılır ve audit_log'a yazılır.
alter table public.ownership_transfers add column if not exists token_hash text;
alter table public.ownership_transfers alter column transfer_token drop not null;
update public.ownership_transfers
   set token_hash = encode(extensions.digest(transfer_token, 'sha256'), 'hex'),
       transfer_token = null
 where transfer_token is not null;
create unique index if not exists ownership_transfers_token_hash_uidx
  on public.ownership_transfers (token_hash) where token_hash is not null;

drop policy if exists owner_manage_own_vehicle_transfers on public.ownership_transfers;
drop policy if exists staff_own_tenant_transfers on public.ownership_transfers;
revoke all on public.ownership_transfers from anon, authenticated;

drop function if exists public.cancel_ownership_transfer(text);
drop function if exists public.initiate_ownership_transfer(uuid);
drop function if exists public.accept_ownership_transfer(text);
drop function if exists public.preview_ownership_transfer(text);
drop function if exists public.list_my_pending_outgoing_transfers();

create function public.initiate_ownership_transfer(p_vehicle_id uuid)
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
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select id, owner_user_id, tenant_id, current_km into v_vehicle
    from public.vehicles where id = p_vehicle_id for update;
  if not found or v_vehicle.owner_user_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.ownership_transfers
    (vehicle_id, tenant_id, previous_owner_user_id, token_hash, transfer_token, token_expires_at, km_at_transfer)
  values
    (p_vehicle_id, null, v_uid, encode(extensions.digest(v_token, 'sha256'), 'hex'), null, v_expires, v_vehicle.current_km)
  returning id into v_id;

  update public.vehicles set owner_user_id = null, updated_at = now() where id = p_vehicle_id;

  return jsonb_build_object('transfer_id', v_id, 'token', v_token, 'expires_at', v_expires);
end;
$function$;

create function public.preview_ownership_transfer(p_token text)
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
     or v_row.token_expires_at < now() then
    return null;
  end if;
  select plate, brand, model, year, current_km into v_vehicle from public.vehicles where id = v_row.vehicle_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'plate', v_vehicle.plate, 'brand', v_vehicle.brand, 'model', v_vehicle.model,
    'year', v_vehicle.year, 'current_km', v_vehicle.current_km,
    'expires_at', v_row.token_expires_at,
    'own_transfer', v_row.previous_owner_user_id = auth.uid()
  );
end;
$function$;

create function public.accept_ownership_transfer(p_token text)
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
          jsonb_build_object('vehicle_id', v_row.vehicle_id, 'actor_user_id', v_uid, 'completed_at', now()));

  return jsonb_build_object('ok', true, 'vehicle_id', v_row.vehicle_id);
end;
$function$;

create function public.cancel_ownership_transfer(p_transfer_id uuid)
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

create function public.list_my_pending_outgoing_transfers()
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
      'plate', v.plate, 'brand', v.brand, 'model', v.model
    ) order by t.created_at desc), '[]'::jsonb)
  into v_result
  from public.ownership_transfers t
  join public.vehicles v on v.id = t.vehicle_id
  where t.previous_owner_user_id = auth.uid()
    and t.accepted_at is null and t.cancelled_at is null;
  return v_result;
end;
$function$;

revoke all on function public.initiate_ownership_transfer(uuid) from public, anon;
revoke all on function public.preview_ownership_transfer(text) from public, anon;
revoke all on function public.accept_ownership_transfer(text) from public, anon;
revoke all on function public.cancel_ownership_transfer(uuid) from public, anon;
revoke all on function public.list_my_pending_outgoing_transfers() from public, anon;
grant execute on function public.initiate_ownership_transfer(uuid) to authenticated, service_role;
grant execute on function public.preview_ownership_transfer(text) to authenticated, service_role;
grant execute on function public.accept_ownership_transfer(text) to authenticated, service_role;
grant execute on function public.cancel_ownership_transfer(uuid) to authenticated, service_role;
grant execute on function public.list_my_pending_outgoing_transfers() to authenticated, service_role;

-- Araç sahibi yalnız KENDİ yaptığı işlemlerin denetim kayıtlarını görür;
-- devirden sonra yeni sahip eski sahibin kayıtlarını, eski sahip yeni
-- sahibin kayıtlarını göremez.
drop policy if exists owner_select_own_vehicle_audit_log on public.audit_log;
create policy owner_select_own_audit_log on public.audit_log for select to authenticated
  using ((detail ->> 'actor_user_id') = (auth.uid())::text);
