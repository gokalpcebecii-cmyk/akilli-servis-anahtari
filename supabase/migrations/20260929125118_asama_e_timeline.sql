-- OTOİZ Aşama E — kullanıcı değeri ve operasyon UX.
-- Önce staging; production için proje sahibinin ayrı onayı gerekir.
-- Yalnız EKLEME yapar: tablo/veri silinmez, mevcut yetki mantığı değişmez.
--
--  1) Servis hızlı kayıt kalemleri: Yakıt filtresi, Fren balatası, Şanzıman yağı, Antifriz
--  2) vehicle_timeline(): araç zaman çizelgesi (bakım kayıtları + araç olayları), sayfalı
--  3) vehicle_for_qr_viewer(): QR okutan giriş yapmış servis/sahip için araç kısayolu

---------------------------------------------------------------------------
-- 1) Bakım kalemi anahtarları (mevcut anahtarlar aynen korunur)
---------------------------------------------------------------------------
alter table public.maintenance_items drop constraint if exists maintenance_items_item_key_check;
alter table public.maintenance_items add constraint maintenance_items_item_key_check check (item_key = any (array[
  'motor_yagi','yag_filtresi','hava_filtresi','polen_filtresi','fren_disk_balata','triger_seti','aku','lastik',
  'fren_on_balata','fren_arka_balata','fren_diski','buji','silecek',
  'yakit_filtresi','fren_balatasi','sanziman_yagi','antifriz'
]::text[]));

---------------------------------------------------------------------------
-- 2) Araç zaman çizelgesi (salt okuma)
---------------------------------------------------------------------------
-- Yetki maintenance_record_history ile aynı: araç sahibi ya da aracın ONAYLI
-- servisi. Servis personeli yalnız KENDİ servisinin kayıtlarını görür (RLS ile
-- birebir aynı sınır); araç sahibi aracın tüm kayıtlarını görür.
-- Araç olayları kişisel veri taşımaz: devirde kimin devrettiği/aldığı, QR'da
-- kod/seri döndürülmez.
create or replace function public.vehicle_timeline(p_vehicle_id uuid, p_offset integer default 0, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_tenant uuid;
  v_created timestamptz;
  v_owner_view boolean;
  v_staff_view boolean;
  v_lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_off integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_rows jsonb;
  v_total bigint;
begin
  if v_uid is null or p_vehicle_id is null then
    return null;
  end if;
  select v.owner_user_id, v.tenant_id, v.created_at into v_owner, v_tenant, v_created
    from public.vehicles v where v.id = p_vehicle_id;
  if not found then
    return null;
  end if;
  v_owner_view := v_owner is not null and v_owner = v_uid;
  v_staff_view := v_tenant is not null and v_tenant = any (array(select public.approved_staff_tenant_ids()));
  if not v_owner_view and not v_staff_view then
    return null;
  end if;

  with ev as (
    select m.id, case when m.tenant_id is null then 'owner' else 'service' end as source, 'record'::text as kind,
           m.service_date as event_date, m.created_at as event_ts, m.km_at_service as km, m.description as title,
           coalesce(m.revision, 0) > 0 as revised, coalesce(m.revision, 0) as revision,
           case when m.tenant_id is not null then t.name end as service_name
      from public.maintenance_records m
      left join public.tenants t on t.id = m.tenant_id
     where m.vehicle_id = p_vehicle_id
       and (v_owner_view or m.tenant_id = v_tenant)
    union all
    select p_vehicle_id, 'system', 'vehicle_created', (v_created at time zone 'Europe/Istanbul')::date, v_created,
           null::integer, 'Araç OTOİZ''e eklendi', false, 0, null
    union all
    select o.id, 'system', 'ownership_transfer',
           (coalesce(o.accepted_at, o.created_at) at time zone 'Europe/Istanbul')::date, coalesce(o.accepted_at, o.created_at),
           o.km_at_transfer, 'Sahiplik devredildi', false, 0, null
      from public.ownership_transfers o
     where o.vehicle_id = p_vehicle_id
       and o.cancelled_at is null
       and (o.accepted_at is not null or (o.token_hash is null and o.transfer_token is null))
    union all
    select q.id, 'system', case when q.replaces_qr_key_id is null then 'qr_linked' else 'qr_replaced' end,
           (q.assigned_at at time zone 'Europe/Istanbul')::date, q.assigned_at, null::integer,
           case when q.replaces_qr_key_id is null then 'OTOİZ anahtarlık bağlandı' else 'OTOİZ anahtarlık yenilendi' end,
           false, 0, null
      from public.qr_keys q
     where q.vehicle_id = p_vehicle_id and q.assigned_at is not null
  ),
  page as (
    select * from ev order by event_date desc, event_ts desc, id desc offset v_off limit v_lim + 1
  )
  select (select count(*) from ev),
         coalesce((select jsonb_agg(to_jsonb(p) order by p.event_date desc, p.event_ts desc, p.id desc) from page p), '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(v_rows) with ordinality x(e, i) where i <= v_lim),
    'has_more', jsonb_array_length(v_rows) > v_lim,
    'total', v_total,
    'viewer', case when v_owner_view then 'owner' else 'service' end);
end;
$$;
revoke all on function public.vehicle_timeline(uuid, integer, integer) from public, anon;
grant execute on function public.vehicle_timeline(uuid, integer, integer) to authenticated;

---------------------------------------------------------------------------
-- 3) QR okutan giriş yapmış kullanıcı için araç kısayolu
---------------------------------------------------------------------------
-- Yalnız aracın onaylı servisi ('service') ya da sahibi ('owner') için araç
-- kimliğini döndürür; diğer herkes için null (pasaport herkese açık kalır,
-- ama iç araç kimliği yalnız yetkiliye verilir).
create or replace function public.vehicle_for_qr_viewer(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vehicle uuid;
  v_owner uuid;
  v_tenant uuid;
begin
  if v_uid is null or p_code is null or length(p_code) > 64 then
    return null;
  end if;
  select q.vehicle_id into v_vehicle from public.qr_keys q
   where q.code = p_code and q.revoked_at is null and q.vehicle_id is not null;
  if v_vehicle is null then
    return null;
  end if;
  select v.owner_user_id, v.tenant_id into v_owner, v_tenant from public.vehicles v where v.id = v_vehicle;
  if v_tenant is not null and v_tenant = any (array(select public.approved_staff_tenant_ids())) then
    return jsonb_build_object('vehicle_id', v_vehicle, 'role', 'service');
  elsif v_owner is not null and v_owner = v_uid then
    return jsonb_build_object('vehicle_id', v_vehicle, 'role', 'owner');
  end if;
  return null;
end;
$$;
revoke all on function public.vehicle_for_qr_viewer(text) from public, anon;
grant execute on function public.vehicle_for_qr_viewer(text) to authenticated;
