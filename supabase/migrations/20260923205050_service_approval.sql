-- OTOİZ — Servis güven modeli: yeni servis "pending" başlar; yalnız platform
-- yöneticisinin onayladığı ("approved") servis araç/bakım/QR işlemi yapabilir
-- ve "Servis Doğrulamalı" kayıt üretebilir. Mevcut servisler bu migration ile
-- "approved" olarak kalır (sütun önce 'approved' varsayılanla eklenir, sonra
-- varsayılan 'pending' yapılır — ayrı bir UPDATE satırı yoktur).
alter table public.tenants add column if not exists approval_status text not null default 'approved';
alter table public.tenants alter column approval_status set default 'pending';
alter table public.tenants drop constraint if exists tenants_approval_status_chk;
alter table public.tenants add constraint tenants_approval_status_chk check (approval_status in ('pending','approved','rejected'));
alter table public.tenants add column if not exists approval_decided_at timestamptz;
alter table public.tenants add column if not exists approval_decided_by uuid;

-- Onaylı servis personelinin tenant kimlikleri (RLS yardımcı fonksiyonu).
create or replace function public.approved_staff_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.tenant_id
  from public.staff_users s
  join public.tenants t on t.id = s.tenant_id
  where s.id = auth.uid() and t.approval_status = 'approved'
$$;
revoke all on function public.approved_staff_tenant_ids() from public, anon;
grant execute on function public.approved_staff_tenant_ids() to authenticated, service_role;

-- vehicles
drop policy if exists staff_modify_own_tenant_vehicles on public.vehicles;
drop policy if exists staff_select_own_tenant_vehicles on public.vehicles;
create policy staff_select_own_tenant_vehicles on public.vehicles for select
  using (tenant_id in (select public.approved_staff_tenant_ids()));
create policy staff_modify_own_tenant_vehicles on public.vehicles for all
  using (tenant_id in (select public.approved_staff_tenant_ids()))
  with check (tenant_id in (select public.approved_staff_tenant_ids()));

-- maintenance_records
drop policy if exists staff_modify_own_tenant_records on public.maintenance_records;
drop policy if exists staff_select_own_tenant_records on public.maintenance_records;
create policy staff_select_own_tenant_records on public.maintenance_records for select
  using (tenant_id in (select public.approved_staff_tenant_ids()));
create policy staff_modify_own_tenant_records on public.maintenance_records for all
  using (tenant_id in (select public.approved_staff_tenant_ids()))
  with check (
    tenant_id in (select public.approved_staff_tenant_ids())
    and vehicle_id in (select v.id from public.vehicles v where v.tenant_id in (select public.approved_staff_tenant_ids()))
  );

-- maintenance_items
drop policy if exists "Servis kendi işletmesinin bakım kalemlerini düzenleyebilir" on public.maintenance_items;
drop policy if exists "Servis kendi işletmesinin bakım kalemlerini görebilir" on public.maintenance_items;
create policy staff_select_own_tenant_items on public.maintenance_items for select
  using (vehicle_id in (select v.id from public.vehicles v where v.tenant_id in (select public.approved_staff_tenant_ids())));
create policy staff_modify_own_tenant_items on public.maintenance_items for all
  using (vehicle_id in (select v.id from public.vehicles v where v.tenant_id in (select public.approved_staff_tenant_ids())))
  with check (vehicle_id in (select v.id from public.vehicles v where v.tenant_id in (select public.approved_staff_tenant_ids())));

-- customers
drop policy if exists staff_select_own_tenant_customers on public.customers;
create policy staff_select_own_tenant_customers on public.customers for all
  using (tenant_id in (select public.approved_staff_tenant_ids()))
  with check (tenant_id in (select public.approved_staff_tenant_ids()));

-- qr_keys (yalnız okuma; yazma zaten yalnız sunucu)
drop policy if exists staff_select_own_tenant_qr_keys on public.qr_keys;
create policy staff_select_own_tenant_qr_keys on public.qr_keys for select to authenticated
  using (vehicle_id in (select v.id from public.vehicles v where v.tenant_id in (select public.approved_staff_tenant_ids())));

-- Pasaport: "Servis Doğrulamalı" yalnız ONAYLI servisin kaydı için; servis
-- bilgisi yalnız onaylı servis için gösterilir. Değer istemciden gelmez,
-- kaydın tenant_id'si ve tenant onay durumundan sunucuda türetilir.
create or replace function public.get_public_vehicle_passport(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  where id = v_vehicle.tenant_id and approval_status = 'approved';

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'description', r.description,
      'created_at', r.created_at,
      'km_at_service', r.km_at_service,
      'service_verified', (r.tenant_id is not null and t.approval_status = 'approved')
    ) order by r.created_at desc), '[]'::jsonb)
  into v_records
  from public.maintenance_records r
  left join public.tenants t on t.id = r.tenant_id
  where r.vehicle_id = v_vehicle.id;

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
