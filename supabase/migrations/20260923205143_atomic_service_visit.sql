-- OTOİZ — Bakım kaydı veri bütünlüğü: araç km/sonraki bakım güncellemesi,
-- bakım kalemleri ve bakım kaydı TEK transaction içinde (tek RPC) yazılır;
-- herhangi bir adım hata verirse hiçbiri kalıcı olmaz. Aynı istek kimliğiyle
-- (p_request_id) tekrar gönderim ikinci bir kayıt üretmez.
-- SECURITY INVOKER: tüm yazmalar çağıranın RLS yetkileriyle yapılır.
-- Kaydın servis kaydı mı ("Servis Doğrulamalı") yoksa kullanıcı kaydı mı
-- olduğu istemciden alınmaz; çağıranın ONAYLI servis personeli olup aracın
-- o servise ait olmasına göre veritabanında belirlenir.
alter table public.maintenance_records add column if not exists client_request_id uuid;
create unique index if not exists maintenance_records_client_request_uidx
  on public.maintenance_records (client_request_id) where client_request_id is not null;

create or replace function public.record_service_visit(
  p_vehicle_id uuid,
  p_km integer,
  p_items jsonb,
  p_description text,
  p_next_km integer,
  p_next_date date,
  p_request_id uuid
)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_vehicle record;
  v_tenant uuid;
  v_existing uuid;
  v_record_id uuid;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_item jsonb;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'request_id_required';
  end if;

  select id into v_existing from public.maintenance_records where client_request_id = p_request_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'record_id', v_existing);
  end if;

  if p_description is null or length(btrim(p_description)) = 0 then
    raise exception 'description_required';
  end if;
  if p_km is null or p_km < 0 then
    raise exception 'invalid_km';
  end if;

  select id, tenant_id, owner_user_id, current_km into v_vehicle
    from public.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_vehicle.tenant_id is not null
     and v_vehicle.tenant_id in (select public.approved_staff_tenant_ids()) then
    v_tenant := v_vehicle.tenant_id;
  elsif v_vehicle.owner_user_id = v_uid then
    v_tenant := null;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_vehicle.current_km is not null and p_km < v_vehicle.current_km then
    raise exception 'km_lower_than_current';
  end if;
  if p_next_km is not null and p_next_km <= p_km then
    raise exception 'invalid_next_km';
  end if;
  if p_next_date is not null and p_next_date < v_today then
    raise exception 'invalid_next_date';
  end if;

  begin
    update public.vehicles
       set current_km = p_km, next_service_km = p_next_km, next_service_date = p_next_date, updated_at = now()
     where id = p_vehicle_id;

    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      insert into public.maintenance_items (vehicle_id, item_key, last_service_date, last_service_km, interval_km)
      values (p_vehicle_id, v_item->>'key', v_today, p_km, nullif(v_item->>'interval_km', '')::integer)
      on conflict (vehicle_id, item_key) do update
        set last_service_date = excluded.last_service_date,
            last_service_km = excluded.last_service_km,
            interval_km = excluded.interval_km;
    end loop;

    insert into public.maintenance_records
      (vehicle_id, tenant_id, service_date, km_at_service, description, created_by, client_request_id)
    values
      (p_vehicle_id, v_tenant, v_today, p_km, btrim(p_description), v_uid, p_request_id)
    returning id into v_record_id;
  exception when unique_violation then
    select id into v_existing from public.maintenance_records where client_request_id = p_request_id;
    if v_existing is null then
      raise;
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'record_id', v_existing);
  end;

  return jsonb_build_object('ok', true, 'duplicate', false, 'record_id', v_record_id, 'service_verified', v_tenant is not null);
end;
$function$;
revoke all on function public.record_service_visit(uuid, integer, jsonb, text, integer, date, uuid) from public, anon;
grant execute on function public.record_service_visit(uuid, integer, jsonb, text, integer, date, uuid) to authenticated, service_role;
