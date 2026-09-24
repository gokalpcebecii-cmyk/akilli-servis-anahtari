-- OTOİZ — 2026-09-23: Pasaport sayfası servis kayıtlarını da "Kullanıcı Kaydı"
-- gösteriyordu; fonksiyon kayıt başına tenant bilgisini döndürmüyordu.
-- Kayıt başına yalnız bir doğruluk bayrağı ('service_verified') eklenir;
-- işletme kimliği (uuid) herkese açık yanıta konmaz. CREATE OR REPLACE
-- mevcut yetkileri (grant) korur.
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
      'km_at_service', km_at_service,
      'service_verified', (tenant_id is not null)
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
      -- Anahtarlık kaybolursa bulan kişi aracı plakadan bulamasın:
      -- yalnız il kodu + son 2 karakter gösterilir (ör. 06 ••• 05).
      'plate', case when v_vehicle.plate is null then null else
        left(replace(v_vehicle.plate, ' ', ''), 2) || ' ••• ' || right(replace(v_vehicle.plate, ' ', ''), 2) end,
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
$function$;
