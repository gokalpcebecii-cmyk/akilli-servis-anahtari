-- P1 fix 5: SET search_path TO 'public' still lets an object created in
-- the public schema (by any role able to CREATE there) shadow an
-- unqualified reference inside a SECURITY DEFINER body. Harden to an
-- empty search_path and fully schema-qualify every reference instead.
-- pg_catalog is always implicitly searched regardless, so built-ins
-- (now(), jsonb_build_object, coalesce, interval, replace) need no
-- qualification; gen_random_uuid() comes from pgcrypto in the
-- "extensions" schema and DOES need explicit qualification.

CREATE OR REPLACE FUNCTION public.accept_ownership_transfer(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select * into v_row from public.ownership_transfers where transfer_token = p_token for update;
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

  update public.ownership_transfers set accepted_at = now(), new_owner_user_id = auth.uid() where id = v_row.id;
  update public.vehicles set owner_user_id = auth.uid()
    where id = v_row.vehicle_id and owner_user_id is null;

  return jsonb_build_object('ok', true, 'vehicle_id', v_row.vehicle_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_ownership_transfer(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select * into v_row from public.ownership_transfers where transfer_token = p_token for update;
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

  update public.ownership_transfers set cancelled_at = now() where id = v_row.id;
  update public.vehicles set owner_user_id = v_row.previous_owner_user_id
    where id = v_row.vehicle_id and owner_user_id is null;

  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_vehicle_passport(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qr record;
  v_vehicle record;
  v_tenant record;
  v_records jsonb;
  v_items jsonb;
begin
  select code, vehicle_id, revoked_at into v_qr
  from public.qr_keys
  where code = p_code;

  if not found or v_qr.revoked_at is not null then
    return null;
  end if;

  if v_qr.vehicle_id is null then
    return jsonb_build_object('status', 'unassigned');
  end if;

  select id, plate, brand, model, current_km, tenant_id into v_vehicle
  from public.vehicles
  where id = v_qr.vehicle_id;

  if not found then
    return null;
  end if;

  select name, phone, address into v_tenant
  from public.tenants
  where id = v_vehicle.tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'description', description,
      'created_at', created_at,
      'km_at_service', km_at_service
    ) order by created_at desc), '[]'::jsonb)
  into v_records
  from public.maintenance_records
  where vehicle_id = v_vehicle.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'item_key', item_key,
      'last_service_date', last_service_date,
      'last_service_km', last_service_km,
      'interval_km', interval_km,
      'interval_months', interval_months
    )), '[]'::jsonb)
  into v_items
  from public.maintenance_items
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
 SET search_path TO ''
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

  select owner_user_id into v_owner from public.vehicles where id = p_vehicle_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'forbidden';
  end if;

  v_token := replace(extensions.gen_random_uuid()::text,'-','') || replace(extensions.gen_random_uuid()::text,'-','');
  v_expires := now() + interval '7 days';

  insert into public.ownership_transfers (vehicle_id, tenant_id, previous_owner_user_id, transfer_token, token_expires_at, performed_by)
  values (p_vehicle_id, null, auth.uid(), v_token, v_expires, null)
  returning id into v_transfer_id;

  update public.vehicles set owner_user_id = null where id = p_vehicle_id;

  return jsonb_build_object('transfer_id', v_transfer_id, 'token', v_token, 'expires_at', v_expires);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_my_pending_outgoing_transfers()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
  from public.ownership_transfers t
  join public.vehicles v on v.id = t.vehicle_id
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
 SET search_path TO ''
AS $function$
declare
  v_staff_id uuid;
begin
  select id into v_staff_id from public.staff_users where id = auth.uid();
  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
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
 SET search_path TO ''
AS $function$
declare
  v_staff_id uuid;
  v_tenant_id uuid;
begin
  if new.vehicle_id is not null then
    select id into v_staff_id from public.staff_users where id = auth.uid();
    select tenant_id into v_tenant_id from public.vehicles where id = new.vehicle_id;
    insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
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
 SET search_path TO ''
AS $function$
declare
  v_staff_id uuid;
  v_tenant_id uuid;
begin
  if old.revoked_at is null and new.revoked_at is not null then
    select id into v_staff_id from public.staff_users where id = auth.uid();
    select tenant_id into v_tenant_id from public.vehicles where id = new.vehicle_id;
    insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
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
 SET search_path TO ''
AS $function$
declare
  v_staff_id uuid;
begin
  select id into v_staff_id from public.staff_users where id = auth.uid();
  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
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
 SET search_path TO ''
AS $function$
declare
  v_row record;
  v_vehicle record;
begin
  select * into v_row from public.ownership_transfers where transfer_token = p_token;
  if not found or v_row.cancelled_at is not null or v_row.accepted_at is not null then
    return null;
  end if;
  if v_row.token_expires_at is not null and v_row.token_expires_at < now() then
    return null;
  end if;

  select plate, brand, model, current_km into v_vehicle from public.vehicles where id = v_row.vehicle_id;
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

-- D3 + B7: self-service ownership-transfer RPCs are pilot-disabled
-- (PILOT_FLAGS.ownershipTransferSelfService=false). Minimum-role EXECUTE:
-- service_role only, until the feature ships and this is revisited.
-- get_public_vehicle_passport is NOT part of the disabled pilot flow
-- (it's the always-on public passport view) — its anon/authenticated
-- EXECUTE stays unchanged.
revoke execute on function public.accept_ownership_transfer(text) from authenticated;
revoke execute on function public.cancel_ownership_transfer(text) from authenticated;
revoke execute on function public.initiate_ownership_transfer(uuid) from authenticated;
revoke execute on function public.list_my_pending_outgoing_transfers() from authenticated;
revoke execute on function public.preview_ownership_transfer(text) from anon, authenticated;
