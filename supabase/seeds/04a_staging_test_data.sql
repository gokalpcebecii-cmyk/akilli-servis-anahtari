-- OTOİZ 04A-S — staging'e özel test verisi seed'i.
--
-- BU DOSYA MİGRATION DEĞİLDİR ve hiçbir otomatik deploy/migration
-- zincirine dahil değildir. Yalnızca elle, açıkça STAGING projesine
-- (akilli-servis-anahtari-staging / ctltjunojlaanzurxpzy) karşı
-- çalıştırılmak üzere tasarlanmıştır. SQL'in kendisi hangi projeye karşı
-- çalıştığını bilemez — hedef-proje koruması, bu dosyayı çalıştıran
-- aracın/operatörün sorumluluğundadır: her çalıştırmadan hemen önce
-- proje ref'i (ctltjunojlaanzurxpzy) ayrıca doğrulanmalı ve bu dosya
-- ASLA Production'a (sbfsiwqxbsojcxdutnem) karşı çalıştırılmamalıdır.
--
-- Güvenlik kapısı: aşağıdaki DO bloğu, dört sahte staging Auth
-- kullanıcısının (id, email) çiftlerinin auth.users içinde BİREBİR
-- bulunmasını zorunlu kılar. Dördü de eşleşmezse RAISE EXCEPTION ile
-- durur — transaction abort olduğu için bu dosyadaki HİÇBİR INSERT
-- çalışmaz.
--
-- İdempotentlik: tüm uygulama kayıtları sabit (bu dosyaya gömülü) test
-- UUID'leriyle INSERT ... ON CONFLICT (id) DO UPDATE kullanır. İkinci
-- çalıştırma satır sayılarını ARTIRMAZ, yalnızca aynı sabit kayıtları
-- günceller.
--
-- Bu dosyada YOK: qr_keys, ownership_transfers, gerçek isim/e-posta/
-- telefon/plaka, parola/token/key/secret.

BEGIN;

do $$
declare
  v_matched int;
begin
  select count(*) into v_matched
  from auth.users
  where (id, email) in (
    ('ad87c666-ee8e-447d-a659-a0cd1e053a28'::uuid, 'otoiz-staging-owner-a@example.test'),
    ('50b4db20-9e32-41ba-9edf-977a0d2ec2b2'::uuid, 'otoiz-staging-owner-b@example.test'),
    ('67ffcfb0-beda-49aa-be7d-61e2005e6803'::uuid, 'otoiz-staging-staff-a@example.test'),
    ('00597d6c-3cd9-4017-a2e3-38a15012183e'::uuid, 'otoiz-staging-staff-b@example.test')
  );

  if v_matched <> 4 then
    raise exception 'OTOİZ 04A-S seed güvenlik kapısı: beklenen 4 test Auth kullanıcısından yalnızca % tanesi auth.users içinde (id,email) birebir eşleşti. Hiçbir kayıt oluşturulmadı.', v_matched;
  end if;
end $$;

-- ============================================================
-- Sabit test kimlikleri (Auth Admin API ile önceden oluşturuldu)
-- ============================================================
-- Owner A : ad87c666-ee8e-447d-a659-a0cd1e053a28
-- Owner B : 50b4db20-9e32-41ba-9edf-977a0d2ec2b2
-- Staff A : 67ffcfb0-beda-49aa-be7d-61e2005e6803
-- Staff B : 00597d6c-3cd9-4017-a2e3-38a15012183e

-- ============================================================
-- Tenants
-- ============================================================
insert into public.tenants (id, name, slug, phone, address, is_active)
values
  ('04a00000-a000-4000-a000-000000000001', 'OTOİZ Staging Servis A [TEST]', 'otoiz-staging-servis-a-test', '+90 500 000 00 01 [TEST]', 'Test Mahallesi, Test Caddesi No:1, İstanbul [TEST]', true),
  ('04a00000-a000-4000-a000-000000000002', 'OTOİZ Staging Servis B [TEST]', 'otoiz-staging-servis-b-test', '+90 500 000 00 02 [TEST]', 'Test Mahallesi, Test Caddesi No:2, Ankara [TEST]', true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  phone = excluded.phone,
  address = excluded.address,
  is_active = excluded.is_active;

-- ============================================================
-- Staff (staff_users.id == auth.users.id, doğrudan bağ)
-- ============================================================
insert into public.staff_users (id, tenant_id, full_name, role)
values
  ('67ffcfb0-beda-49aa-be7d-61e2005e6803', '04a00000-a000-4000-a000-000000000001', 'Staff A [TEST]', 'owner'),
  ('00597d6c-3cd9-4017-a2e3-38a15012183e', '04a00000-a000-4000-a000-000000000002', 'Staff B [TEST]', 'owner')
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  full_name = excluded.full_name,
  role = excluded.role;

-- ============================================================
-- Customers (Tenant A: 2, Tenant B: 2)
-- ============================================================
insert into public.customers (id, tenant_id, full_name, phone, email)
values
  ('04a00000-a000-4000-a000-000000000101', '04a00000-a000-4000-a000-000000000001', 'Test Müşteri A1 [TEST]', '+90 500 100 00 01 [TEST]', 'test-musteri-a1@example.test'),
  ('04a00000-a000-4000-a000-000000000102', '04a00000-a000-4000-a000-000000000001', 'Test Müşteri A2 [TEST]', '+90 500 100 00 02 [TEST]', 'test-musteri-a2@example.test'),
  ('04a00000-a000-4000-a000-000000000201', '04a00000-a000-4000-a000-000000000002', 'Test Müşteri B1 [TEST]', '+90 500 200 00 01 [TEST]', 'test-musteri-b1@example.test'),
  ('04a00000-a000-4000-a000-000000000202', '04a00000-a000-4000-a000-000000000002', 'Test Müşteri B2 [TEST]', '+90 500 200 00 02 [TEST]', 'test-musteri-b2@example.test')
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  full_name = excluded.full_name,
  phone = excluded.phone,
  email = excluded.email;

-- ============================================================
-- Vehicles
-- Tenant A: 06 TST 001 (yaklaşan bakım, +14 gün), 06 TST 002 (gecikmiş bakım, -20 gün)
-- Tenant B: 06 TST 003, 06 TST 004 — Tenant A'dan tamamen ayrı
-- Bireysel: 06 TST 005 (Owner A), 06 TST 006 (Owner B) — tenant_id NULL
-- ============================================================
insert into public.vehicles (id, tenant_id, customer_id, owner_user_id, plate, brand, model, year, current_km, next_service_km, next_service_date, notes)
values
  ('04a00000-a000-4000-a000-000000000301', '04a00000-a000-4000-a000-000000000001', '04a00000-a000-4000-a000-000000000101', null, '06 TST 001', 'Renault', 'Clio', 2019, 68000, 78000, current_date + interval '14 days', '[TEST] Sahte staging test aracı — yaklaşan bakım'),
  ('04a00000-a000-4000-a000-000000000302', '04a00000-a000-4000-a000-000000000001', '04a00000-a000-4000-a000-000000000102', null, '06 TST 002', 'Fiat', 'Egea', 2021, 42000, 45000, current_date - interval '20 days', '[TEST] Sahte staging test aracı — gecikmiş bakım'),
  ('04a00000-a000-4000-a000-000000000401', '04a00000-a000-4000-a000-000000000002', '04a00000-a000-4000-a000-000000000201', null, '06 TST 003', 'Toyota', 'Corolla', 2020, 55000, 65000, current_date + interval '30 days', '[TEST] Sahte staging test aracı'),
  ('04a00000-a000-4000-a000-000000000402', '04a00000-a000-4000-a000-000000000002', '04a00000-a000-4000-a000-000000000202', null, '06 TST 004', 'Hyundai', 'i20', 2022, 15000, 25000, current_date + interval '60 days', '[TEST] Sahte staging test aracı'),
  ('04a00000-a000-4000-a000-000000000501', null, null, 'ad87c666-ee8e-447d-a659-a0cd1e053a28', '06 TST 005', 'Volkswagen', 'Polo', 2020, 45000, 55000, current_date + interval '90 days', '[TEST] Bireysel staging test aracı (Owner A)'),
  ('04a00000-a000-4000-a000-000000000502', null, null, '50b4db20-9e32-41ba-9edf-977a0d2ec2b2', '06 TST 006', 'Opel', 'Corsa', 2018, 90000, 100000, current_date + interval '45 days', '[TEST] Bireysel staging test aracı (Owner B)')
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  customer_id = excluded.customer_id,
  owner_user_id = excluded.owner_user_id,
  plate = excluded.plate,
  brand = excluded.brand,
  model = excluded.model,
  year = excluded.year,
  current_km = excluded.current_km,
  next_service_km = excluded.next_service_km,
  next_service_date = excluded.next_service_date,
  notes = excluded.notes;

-- ============================================================
-- Maintenance records — Tenant A: 3, Tenant B: 3 (tamamen ayrı),
-- Owner A: 1, Owner B: 1 (tenant_id NULL — bireysel ayrımı)
-- ============================================================
insert into public.maintenance_records (id, vehicle_id, tenant_id, service_date, km_at_service, description, cost, created_by)
values
  ('04a00000-a000-4000-a000-000000000601', '04a00000-a000-4000-a000-000000000301', '04a00000-a000-4000-a000-000000000001', current_date - interval '180 days', 60000, '[TEST] Motor yağı değişimi', 1200.00, '67ffcfb0-beda-49aa-be7d-61e2005e6803'),
  ('04a00000-a000-4000-a000-000000000602', '04a00000-a000-4000-a000-000000000301', '04a00000-a000-4000-a000-000000000001', current_date - interval '30 days', 66000, '[TEST] Fren balata kontrolü', 800.00, '67ffcfb0-beda-49aa-be7d-61e2005e6803'),
  ('04a00000-a000-4000-a000-000000000603', '04a00000-a000-4000-a000-000000000302', '04a00000-a000-4000-a000-000000000001', current_date - interval '90 days', 38000, '[TEST] Genel bakım', 1500.00, '67ffcfb0-beda-49aa-be7d-61e2005e6803'),
  ('04a00000-a000-4000-a000-000000000604', '04a00000-a000-4000-a000-000000000401', '04a00000-a000-4000-a000-000000000002', current_date - interval '200 days', 48000, '[TEST] Triger seti değişimi', 3200.00, '00597d6c-3cd9-4017-a2e3-38a15012183e'),
  ('04a00000-a000-4000-a000-000000000605', '04a00000-a000-4000-a000-000000000401', '04a00000-a000-4000-a000-000000000002', current_date - interval '15 days', 54000, '[TEST] Lastik değişimi', 4000.00, '00597d6c-3cd9-4017-a2e3-38a15012183e'),
  ('04a00000-a000-4000-a000-000000000606', '04a00000-a000-4000-a000-000000000402', '04a00000-a000-4000-a000-000000000002', current_date - interval '60 days', 10000, '[TEST] Klima bakımı', 600.00, '00597d6c-3cd9-4017-a2e3-38a15012183e'),
  ('04a00000-a000-4000-a000-000000000701', '04a00000-a000-4000-a000-000000000501', null, current_date - interval '45 days', 42000, '[TEST] Yağ ve filtre değişimi', 1100.00, 'ad87c666-ee8e-447d-a659-a0cd1e053a28'),
  ('04a00000-a000-4000-a000-000000000702', '04a00000-a000-4000-a000-000000000502', null, current_date - interval '100 days', 85000, '[TEST] Akü değişimi', 1800.00, '50b4db20-9e32-41ba-9edf-977a0d2ec2b2')
on conflict (id) do update set
  vehicle_id = excluded.vehicle_id,
  tenant_id = excluded.tenant_id,
  service_date = excluded.service_date,
  km_at_service = excluded.km_at_service,
  description = excluded.description,
  cost = excluded.cost,
  created_by = excluded.created_by;

COMMIT;
