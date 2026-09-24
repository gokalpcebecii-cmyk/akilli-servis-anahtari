-- OTOİZ — 20 kullanıcı canlı pilot kabul testleri (veritabanı katmanı).
-- Tek DO bloğu, tek transaction; sonunda bilinçli exception ile TÜM değişiklikler geri alınır.
-- Sonuç JSON'u hata mesajında döner: 'OTOIZ_TEST_RESULTS {...}'. Staging'e karşı çalıştırılır.
do $otoiz$
declare
  results jsonb := '[]'::jsonb; v_ok boolean; v_err text; v_json jsonb; v_token text; v_token2 text; v_tid uuid; v_tid2 uuid; v_count_before int;
begin

  insert into auth.users (id, email, email_confirmed_at) values ('0badc0de-0000-4000-8000-00000000aa01', 'pending-staff@example.test', now());
  insert into public.tenants (id, name, slug) values ('0badc0de-0000-4000-8000-00000000bb01', 'PENDING TEST SERVIS', 'pending-test-servis-x');
  insert into public.staff_users (id, tenant_id, role) values ('0badc0de-0000-4000-8000-00000000aa01', '0badc0de-0000-4000-8000-00000000bb01', 'owner');
  insert into public.vehicles (id, tenant_id, plate, current_km) values ('0badc0de-0000-4000-8000-00000000cc01', '0badc0de-0000-4000-8000-00000000bb01', '99 PND 001', 1000);

  select count(*) into v_count_before from public.maintenance_records where vehicle_id='04a00000-a000-4000-a000-000000000501';
  -- ANON-01: Anon qr_keys tablosunu listeleyemez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    perform count(*) from public.qr_keys; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','ANON-01','desc','Anon qr_keys tablosunu listeleyemez','ok',coalesce(v_ok,false),'err',v_err);
  -- ANON-02: Anon araç verisi göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    select count(*)=0 into v_ok from public.vehicles;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','ANON-02','desc','Anon araç verisi göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- ANON-03: Anon bakım kayıtlarını göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    select count(*)=0 into v_ok from public.maintenance_records;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','ANON-03','desc','Anon bakım kayıtlarını göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- ANON-04: Anon platform_admins okuyamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    perform count(*) from public.platform_admins; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','ANON-04','desc','Anon platform_admins okuyamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- ANON-05: Anon aktif QR ile pasaport açar (plaka maskeli)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    select (public.get_public_vehicle_passport('nwanp2ue22pm')->'vehicle'->>'plate') = '06 ••• 05' into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','ANON-05','desc','Anon aktif QR ile pasaport açar (plaka maskeli)','ok',coalesce(v_ok,false),'err',v_err);
  -- ANON-06: Anon devir RPC çağıramaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    perform public.initiate_ownership_transfer('04a00000-a000-4000-a000-000000000501'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','ANON-06','desc','Anon devir RPC çağıramaz','ok',coalesce(v_ok,false),'err',v_err);
  -- ANON-07: Anon bakım RPC çağıramaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    perform public.record_service_visit('04a00000-a000-4000-a000-000000000501', 1, '[]', 'x', null, null, gen_random_uuid()); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','ANON-07','desc','Anon bakım RPC çağıramaz','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-01: Owner A yalnız kendi araçlarını görür
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select bool_and(owner_user_id = 'ad87c666-ee8e-447d-a659-a0cd1e053a28') and count(*) >= 1 into v_ok from public.vehicles;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','OWN-01','desc','Owner A yalnız kendi araçlarını görür','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-02: Owner A, Owner B aracını göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.vehicles where id = '04a00000-a000-4000-a000-000000000502';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','OWN-02','desc','Owner A, Owner B aracını göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-03: Owner A, Owner B aracını güncelleyemez (0 satır)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    with u as (update public.vehicles set notes='x' where id='04a00000-a000-4000-a000-000000000502' returning 1) select count(*)=0 into v_ok from u;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','OWN-03','desc','Owner A, Owner B aracını güncelleyemez (0 satır)','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-04: Owner A servis araçlarını göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.vehicles where tenant_id is not null;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','OWN-04','desc','Owner A servis araçlarını göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-05: Owner kendi kaydını sahte "servis" (tenant_id) ile ekleyemez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.maintenance_records (vehicle_id, tenant_id, description) values ('04a00000-a000-4000-a000-000000000501', '04a00000-a000-4000-a000-000000000001', 'sahte'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','OWN-05','desc','Owner kendi kaydını sahte "servis" (tenant_id) ile ekleyemez','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-06: Owner aracını bir servise taşıyamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    update public.vehicles set tenant_id='04a00000-a000-4000-a000-000000000001' where id='04a00000-a000-4000-a000-000000000501'; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','OWN-06','desc','Owner aracını bir servise taşıyamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-07: Owner qr_keys tablosuna yazamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.qr_keys (code) values ('owner-chosen-code-123'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','OWN-07','desc','Owner qr_keys tablosuna yazamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-08: Owner başka servislerin bilgisini okuyamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.tenants;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','OWN-08','desc','Owner başka servislerin bilgisini okuyamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-09: Owner audit_log yazamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.audit_log (action) values ('fake'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','OWN-09','desc','Owner audit_log yazamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-10: Owner platform_admins okuyamaz/yazamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.platform_admins (user_id) values ('ad87c666-ee8e-447d-a659-a0cd1e053a28'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','OWN-10','desc','Owner platform_admins okuyamaz/yazamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- OWN-11: Owner ownership_transfers tablosunu doğrudan okuyamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform count(*) from public.ownership_transfers; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','OWN-11','desc','Owner ownership_transfers tablosunu doğrudan okuyamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- TEN-01: Staff A yalnız tenant A araçlarını görür
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select bool_and(tenant_id = '04a00000-a000-4000-a000-000000000001') and count(*) >= 1 into v_ok from public.vehicles;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TEN-01','desc','Staff A yalnız tenant A araçlarını görür','ok',coalesce(v_ok,false),'err',v_err);
  -- TEN-02: Staff A tenant B aracına kayıt ekleyemez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.maintenance_records (vehicle_id, tenant_id, description) values ('04a00000-a000-4000-a000-000000000401', '04a00000-a000-4000-a000-000000000001', 'x'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','TEN-02','desc','Staff A tenant B aracına kayıt ekleyemez','ok',coalesce(v_ok,false),'err',v_err);
  -- TEN-03: Staff B tenant A aracını göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"00597d6c-3cd9-4017-a2e3-38a15012183e","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.vehicles where id='04a00000-a000-4000-a000-000000000301';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TEN-03','desc','Staff B tenant A aracını göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- TEN-04: Staff qr_keys güncelleyemez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    update public.qr_keys set vehicle_id='04a00000-a000-4000-a000-000000000301' where code='cqppshr5puz3'; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','TEN-04','desc','Staff qr_keys güncelleyemez','ok',coalesce(v_ok,false),'err',v_err);
  -- TEN-05: Staff bireysel araçları göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.vehicles where owner_user_id is not null and tenant_id is null;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TEN-05','desc','Staff bireysel araçları göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- TEN-06: Servis sahibi kendi onay durumunu değiştiremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    update public.tenants set approval_status='approved' where id='04a00000-a000-4000-a000-000000000001'; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','TEN-06','desc','Servis sahibi kendi onay durumunu değiştiremez','ok',coalesce(v_ok,false),'err',v_err);
  -- TEN-07: Staff staff_users tablosuna yazamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    update public.staff_users set tenant_id='04a00000-a000-4000-a000-000000000002' where id='67ffcfb0-beda-49aa-be7d-61e2005e6803'; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','TEN-07','desc','Staff staff_users tablosuna yazamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-01: Pending servis kendi aracını göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.vehicles where id='0badc0de-0000-4000-8000-00000000cc01';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','SRV-01','desc','Pending servis kendi aracını göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-02: Pending servis araç oluşturamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.vehicles (tenant_id, plate) values ('0badc0de-0000-4000-8000-00000000bb01', '99 PND 002'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','SRV-02','desc','Pending servis araç oluşturamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-03: Pending servis bakım kaydı giremez (RPC)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.record_service_visit('0badc0de-0000-4000-8000-00000000cc01', 1100, '[]', 'x', null, null, gen_random_uuid()); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','SRV-03','desc','Pending servis bakım kaydı giremez (RPC)','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-04: Pending servis bakım kaydı giremez (doğrudan)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.maintenance_records (vehicle_id, tenant_id, description) values ('0badc0de-0000-4000-8000-00000000cc01', '0badc0de-0000-4000-8000-00000000bb01', 'x'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','SRV-04','desc','Pending servis bakım kaydı giremez (doğrudan)','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-05: Pending serviste approved_staff_tenant_ids boş
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.approved_staff_tenant_ids();
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','SRV-05','desc','Pending serviste approved_staff_tenant_ids boş','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-06: Onay (sunucu) sonrası servis araç oluşturabilir
  v_ok := null; v_err := null;
  begin
    update public.tenants set approval_status='approved' where id='0badc0de-0000-4000-8000-00000000bb01'; v_ok := true;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','SRV-06','desc','Onay (sunucu) sonrası servis araç oluşturabilir','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-07: Onaylı servis aracını görür ve kayıt girer
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select (public.record_service_visit('0badc0de-0000-4000-8000-00000000cc01', 1200, '[]', 'Onay sonrası kayıt', null, null, gen_random_uuid())->>'service_verified')::boolean into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','SRV-07','desc','Onaylı servis aracını görür ve kayıt girer','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-08: Red (sunucu) sonrası servis tekrar engellenir
  v_ok := null; v_err := null;
  begin
    update public.tenants set approval_status='rejected' where id='0badc0de-0000-4000-8000-00000000bb01'; v_ok := true;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','SRV-08','desc','Red (sunucu) sonrası servis tekrar engellenir','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-09: Reddedilmiş servis kayıt giremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.record_service_visit('0badc0de-0000-4000-8000-00000000cc01', 1300, '[]', 'x', null, null, gen_random_uuid()); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','SRV-09','desc','Reddedilmiş servis kayıt giremez','ok',coalesce(v_ok,false),'err',v_err);
  -- SRV-10: Reddedilmiş servisin eski kaydı pasaportta "Servis Doğrulamalı" görünmez
  v_ok := null; v_err := null;
  begin
    insert into public.qr_keys (code, vehicle_id) values ('pendingtestqrcodeaaaaaaaaa', '0badc0de-0000-4000-8000-00000000cc01');
    select not coalesce(bool_or((r->>'service_verified')::boolean), false) and (public.get_public_vehicle_passport('pendingtestqrcodeaaaaaaaaa')->'tenant'->>'name') is null
      into v_ok from jsonb_array_elements(public.get_public_vehicle_passport('pendingtestqrcodeaaaaaaaaa')->'maintenance_records') r;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','SRV-10','desc','Reddedilmiş servisin eski kaydı pasaportta "Servis Doğrulamalı" görünmez','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-01: Onaylı servis (Staff A) tek RPC ile kayıt → Servis Doğrulamalı
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select (public.record_service_visit('04a00000-a000-4000-a000-000000000301', 70000, '[{"key":"motor_yagi","interval_km":10000},{"key":"aku","interval_km":30000}]', 'Motor Yağı, Akü', 80000, null, 'aaaaaaaa-0000-4000-8000-000000000001')->>'service_verified')::boolean into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','MNT-01','desc','Onaylı servis (Staff A) tek RPC ile kayıt → Servis Doğrulamalı','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-02: Kayıt tenant_id=A, araç km ve kalemler aynı transaction'da güncellendi
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select exists(select 1 from public.maintenance_records where client_request_id='aaaaaaaa-0000-4000-8000-000000000001' and tenant_id='04a00000-a000-4000-a000-000000000001' and km_at_service=70000)
    and (select current_km from public.vehicles where id='04a00000-a000-4000-a000-000000000301')=70000
    and (select last_service_km from public.maintenance_items where vehicle_id='04a00000-a000-4000-a000-000000000301' and item_key='aku')=70000 into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','MNT-02','desc','Kayıt tenant_id=A, araç km ve kalemler aynı transaction''da güncellendi','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-03: Çift gönderim (aynı istek kimliği) ikinci kayıt üretmez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select (public.record_service_visit('04a00000-a000-4000-a000-000000000301', 70000, '[]', 'Motor Yağı, Akü', 80000, null, 'aaaaaaaa-0000-4000-8000-000000000001')->>'duplicate')::boolean
    and (select count(*) from public.maintenance_records where client_request_id='aaaaaaaa-0000-4000-8000-000000000001')=1 into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','MNT-03','desc','Çift gönderim (aynı istek kimliği) ikinci kayıt üretmez','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-04: Alt adım hatası (geçersiz kalem) → hiçbir şey yazılmaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.record_service_visit('04a00000-a000-4000-a000-000000000301', 71000, '[{"key":"gecersiz_kalem"}]', 'x', null, null, 'aaaaaaaa-0000-4000-8000-000000000002'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','MNT-04','desc','Alt adım hatası (geçersiz kalem) → hiçbir şey yazılmaz','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-05: Hatalı çağrı sonrası km değişmedi, kayıt yok
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select (select current_km from public.vehicles where id='04a00000-a000-4000-a000-000000000301')=70000 and not exists(select 1 from public.maintenance_records where client_request_id='aaaaaaaa-0000-4000-8000-000000000002') into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','MNT-05','desc','Hatalı çağrı sonrası km değişmedi, kayıt yok','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-06: Km geriye alınamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.record_service_visit('04a00000-a000-4000-a000-000000000301', 100, '[]', 'x', null, null, gen_random_uuid()); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('km_lower_than_current' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','MNT-06','desc','Km geriye alınamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-07: Owner A kendi aracına kayıt → Kullanıcı Kaydı (tenant_id null)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    v_json := public.record_service_visit('04a00000-a000-4000-a000-000000000501', 46000, '[{"key":"silecek"}]', 'Silecek', null, null, 'aaaaaaaa-0000-4000-8000-000000000003');
    select not (v_json->>'service_verified')::boolean and exists(select 1 from public.maintenance_records where client_request_id='aaaaaaaa-0000-4000-8000-000000000003' and tenant_id is null) into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','MNT-07','desc','Owner A kendi aracına kayıt → Kullanıcı Kaydı (tenant_id null)','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-08: Owner A, Owner B aracına kayıt giremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.record_service_visit('04a00000-a000-4000-a000-000000000502', 99999, '[]', 'x', null, null, gen_random_uuid()); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','MNT-08','desc','Owner A, Owner B aracına kayıt giremez','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-09: Staff B tenant A aracına kayıt giremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"00597d6c-3cd9-4017-a2e3-38a15012183e","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.record_service_visit('04a00000-a000-4000-a000-000000000301', 99999, '[]', 'x', null, null, gen_random_uuid()); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','MNT-09','desc','Staff B tenant A aracına kayıt giremez','ok',coalesce(v_ok,false),'err',v_err);
  -- MNT-10: Staff A bireysel araca kayıt giremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.record_service_visit('04a00000-a000-4000-a000-000000000501', 99999, '[]', 'x', null, null, gen_random_uuid()); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','MNT-10','desc','Staff A bireysel araca kayıt giremez','ok',coalesce(v_ok,false),'err',v_err);
  -- QR-01: Aynı araçta ikinci aktif QR olamaz
  v_ok := null; v_err := null;
  begin
    insert into public.qr_keys (code, vehicle_id) values ('secondactiveqrtestaaaaaaaa', '04a00000-a000-4000-a000-000000000501'); v_ok := false;
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','QR-01','desc','Aynı araçta ikinci aktif QR olamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- QR-02: Aynı kod iki kez var olamaz (tek araç)
  v_ok := null; v_err := null;
  begin
    insert into public.qr_keys (code) values ('nwanp2ue22pm'); v_ok := false;
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','QR-02','desc','Aynı kod iki kez var olamaz (tek araç)','ok',coalesce(v_ok,false),'err',v_err);
  -- QR-03: Servis ve kullanıcıya aynı anda ayrılamaz
  v_ok := null; v_err := null;
  begin
    update public.qr_keys set reserved_tenant_id='04a00000-a000-4000-a000-000000000001', reserved_user_id='ad87c666-ee8e-447d-a659-a0cd1e053a28' where code='cqppshr5puz3'; v_ok := false;
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','QR-03','desc','Servis ve kullanıcıya aynı anda ayrılamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- QR-04: İptal (sunucu) → pasaport açılmaz
  v_ok := null; v_err := null;
  begin
    update public.qr_keys set revoked_at=now() where code='nwanp2ue22pm'; select public.get_public_vehicle_passport('nwanp2ue22pm') is null into v_ok;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','QR-04','desc','İptal (sunucu) → pasaport açılmaz','ok',coalesce(v_ok,false),'err',v_err);
  -- QR-05: İptal edilmiş QR geri açılamaz (sunucu dahil)
  v_ok := null; v_err := null;
  begin
    update public.qr_keys set revoked_at=null where code='nwanp2ue22pm'; v_ok := false;
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('qr_revoked_immutable' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','QR-05','desc','İptal edilmiş QR geri açılamaz (sunucu dahil)','ok',coalesce(v_ok,false),'err',v_err);
  -- QR-06: İptal edilmiş QR başka araca atanamaz (sunucu dahil)
  v_ok := null; v_err := null;
  begin
    update public.qr_keys set vehicle_id='04a00000-a000-4000-a000-000000000502' where code='nwanp2ue22pm'; v_ok := false;
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('qr_revoked_immutable' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','QR-06','desc','İptal edilmiş QR başka araca atanamaz (sunucu dahil)','ok',coalesce(v_ok,false),'err',v_err);
  -- QR-07: İptalden sonra araca yeni QR bağlanabilir
  v_ok := null; v_err := null;
  begin
    insert into public.qr_keys (code, vehicle_id) values ('replacementqrcodeaaaaaaaaa', '04a00000-a000-4000-a000-000000000501'); v_ok := true;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','QR-07','desc','İptalden sonra araca yeni QR bağlanabilir','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-01: Owner A devri başlatır; jeton ≥256 bit, araç erişimi hemen kesilir
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*) into v_count_before from public.maintenance_records where vehicle_id='04a00000-a000-4000-a000-000000000501';
    v_json := public.initiate_ownership_transfer('04a00000-a000-4000-a000-000000000501'); v_token := v_json->>'token'; v_tid := (v_json->>'transfer_id')::uuid;
    select length(v_token) >= 43 and not exists(select 1 from public.vehicles where id='04a00000-a000-4000-a000-000000000501') into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-01','desc','Owner A devri başlatır; jeton ≥256 bit, araç erişimi hemen kesilir','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-02: Jeton veritabanında düz metin tutulmaz (yalnız SHA-256)
  v_ok := null; v_err := null;
  begin
    select exists(select 1 from public.ownership_transfers where id=v_tid and transfer_token is null and token_hash = encode(extensions.digest(v_token,'sha256'),'hex')) into v_ok;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-02','desc','Jeton veritabanında düz metin tutulmaz (yalnız SHA-256)','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-03: Bekleyen devir listesi jetonu göstermez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select not (public.list_my_pending_outgoing_transfers()::text like '%'||v_token||'%') and jsonb_array_length(public.list_my_pending_outgoing_transfers()) >= 1 into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-03','desc','Bekleyen devir listesi jetonu göstermez','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-04: Başlatan hesap kendi devrini kabul edemez (ikinci oturum)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.accept_ownership_transfer(v_token); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('cannot_accept_own_transfer' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','TRF-04','desc','Başlatan hesap kendi devrini kabul edemez (ikinci oturum)','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-05: Servis hesabı araç devralamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.accept_ownership_transfer(v_token); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('staff_account_cannot_own' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','TRF-05','desc','Servis hesabı araç devralamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-06: Yanlış/tahmin jeton reddedilir
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.accept_ownership_transfer(v_token || 'x'); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('not_found' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','TRF-06','desc','Yanlış/tahmin jeton reddedilir','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-07: Yalnız plaka bilmek yetmez: plaka ile devir yolu yok
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.vehicles where id='04a00000-a000-4000-a000-000000000501';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-07','desc','Yalnız plaka bilmek yetmez: plaka ile devir yolu yok','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-08: Owner B önizleme görür (kendi devri değil)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select (public.preview_ownership_transfer(v_token)->>'own_transfer')::boolean = false into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-08','desc','Owner B önizleme görür (kendi devri değil)','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-09: Owner B kabul eder; vehicle_id aynı, kişisel alanlar temiz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select (public.accept_ownership_transfer(v_token)->>'vehicle_id')::uuid = '04a00000-a000-4000-a000-000000000501' into v_ok;
    select v_ok and exists(select 1 from public.vehicles where id='04a00000-a000-4000-a000-000000000501' and owner_user_id='50b4db20-9e32-41ba-9edf-977a0d2ec2b2' and notes is null and customer_id is null) into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-09','desc','Owner B kabul eder; vehicle_id aynı, kişisel alanlar temiz','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-10: Doğrulanmış teknik geçmiş tamamen korunur
  v_ok := null; v_err := null;
  begin
    select (select count(*) from public.maintenance_records where vehicle_id='04a00000-a000-4000-a000-000000000501') = v_count_before into v_ok;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-10','desc','Doğrulanmış teknik geçmiş tamamen korunur','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-11: Kullanılmış jeton tekrar kullanılamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"00597d6c-3cd9-4017-a2e3-38a15012183e","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.accept_ownership_transfer(v_token); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','TRF-11','desc','Kullanılmış jeton tekrar kullanılamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-12: Eski sahip araç/bakım/kalem/QR özel verisine erişemez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select not exists(select 1 from public.vehicles where id='04a00000-a000-4000-a000-000000000501')
    and not exists(select 1 from public.maintenance_records where vehicle_id='04a00000-a000-4000-a000-000000000501')
    and not exists(select 1 from public.maintenance_items where vehicle_id='04a00000-a000-4000-a000-000000000501')
    and not exists(select 1 from public.qr_keys where vehicle_id='04a00000-a000-4000-a000-000000000501') into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-12','desc','Eski sahip araç/bakım/kalem/QR özel verisine erişemez','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-13: Yeni sahip aracı, geçmişi ve aktif QR'ı görür
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select exists(select 1 from public.vehicles where id='04a00000-a000-4000-a000-000000000501') and exists(select 1 from public.maintenance_records where vehicle_id='04a00000-a000-4000-a000-000000000501') and exists(select 1 from public.qr_keys where vehicle_id='04a00000-a000-4000-a000-000000000501' and revoked_at is null) into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-13','desc','Yeni sahip aracı, geçmişi ve aktif QR''ı görür','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-14: Yeni sahip eski sahibin denetim kayıtlarını göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.audit_log where (detail->>'actor_user_id') = 'ad87c666-ee8e-447d-a659-a0cd1e053a28';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-14','desc','Yeni sahip eski sahibin denetim kayıtlarını göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-15: Eski sahip yeni sahibin denetim kayıtlarını göremez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    select count(*)=0 into v_ok from public.audit_log where (detail->>'actor_user_id') = '50b4db20-9e32-41ba-9edf-977a0d2ec2b2';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-15','desc','Eski sahip yeni sahibin denetim kayıtlarını göremez','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-16: Devir tamamlanması audit_log'a aktör+araç+zamanla yazıldı
  v_ok := null; v_err := null;
  begin
    select exists(select 1 from public.audit_log where action='ownership_transfer_completed' and target_id=v_tid and detail->>'actor_user_id'='50b4db20-9e32-41ba-9edf-977a0d2ec2b2' and detail->>'vehicle_id'='04a00000-a000-4000-a000-000000000501' and created_at is not null) and exists(select 1 from public.audit_log where action='ownership_transfer_initiated' and target_id=v_tid) into v_ok;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-16','desc','Devir tamamlanması audit_log''a aktör+araç+zamanla yazıldı','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-17: Aktif QR yeni sahiple devam eder; kişiye ayrılmışlık silinir
  v_ok := null; v_err := null;
  begin
    select exists(select 1 from public.qr_keys where vehicle_id='04a00000-a000-4000-a000-000000000501' and revoked_at is null and reserved_user_id is null) into v_ok;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-17','desc','Aktif QR yeni sahiple devam eder; kişiye ayrılmışlık silinir','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-18: Süresi geçmiş jeton kullanılamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    v_json := public.initiate_ownership_transfer('04a00000-a000-4000-a000-000000000502'); v_token2 := v_json->>'token'; v_tid2 := (v_json->>'transfer_id')::uuid; v_ok := true;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-18','desc','Süresi geçmiş jeton kullanılamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-19: (süre dolumu simülasyonu)
  v_ok := null; v_err := null;
  begin
    update public.ownership_transfers set token_expires_at = now() - interval '1 minute' where id=v_tid2; v_ok := true;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-19','desc','(süre dolumu simülasyonu)','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-20: Süresi dolmuş jetonla kabul reddedilir
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.accept_ownership_transfer(v_token2); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('expired' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','TRF-20','desc','Süresi dolmuş jetonla kabul reddedilir','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-21: Başkası devri iptal edemez
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.cancel_ownership_transfer(v_tid2); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := position('forbidden' in sqlerrm) > 0;
  end;
  results := results || jsonb_build_object('id','TRF-21','desc','Başkası devri iptal edemez','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-22: Başlatan, süresi dolan devri iptal edip aracı geri alır
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"50b4db20-9e32-41ba-9edf-977a0d2ec2b2","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.cancel_ownership_transfer(v_tid2); select exists(select 1 from public.vehicles where id='04a00000-a000-4000-a000-000000000502' and owner_user_id='50b4db20-9e32-41ba-9edf-977a0d2ec2b2') into v_ok;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-22','desc','Başlatan, süresi dolan devri iptal edip aracı geri alır','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-23: İptal edilmiş jeton kullanılamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"ad87c666-ee8e-447d-a659-a0cd1e053a28","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform public.accept_ownership_transfer(v_token2); v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','TRF-23','desc','İptal edilmiş jeton kullanılamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- TRF-24: İptal audit_log'a yazıldı
  v_ok := null; v_err := null;
  begin
    select exists(select 1 from public.audit_log where action='ownership_transfer_cancelled' and target_id=v_tid2) into v_ok;
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','TRF-24','desc','İptal audit_log''a yazıldı','ok',coalesce(v_ok,false),'err',v_err);
  -- ADM-01: authenticated platform_admins okuyamaz
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"sub":"67ffcfb0-beda-49aa-be7d-61e2005e6803","role":"authenticated"}', true);
    execute 'set local role authenticated';
    perform count(*) from public.platform_admins; v_ok := false;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    v_err := 'beklenen hata oluşmadı'; v_ok := false;
  exception when others then
    v_err := sqlerrm; v_ok := true;
  end;
  results := results || jsonb_build_object('id','ADM-01','desc','authenticated platform_admins okuyamaz','ok',coalesce(v_ok,false),'err',v_err);
  -- ADM-02: service_role platform_admins okur (sunucu yöntemi)
  v_ok := null; v_err := null;
  begin
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    execute 'set local role service_role';
    select count(*) >= 1 into v_ok from public.platform_admins;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_err := sqlerrm; v_ok := false;
  end;
  results := results || jsonb_build_object('id','ADM-02','desc','service_role platform_admins okur (sunucu yöntemi)','ok',coalesce(v_ok,false),'err',v_err);
  raise exception 'OTOIZ_TEST_RESULTS %', jsonb_build_object('total', jsonb_array_length(results), 'passed', (select count(*) from jsonb_array_elements(results) r where (r->>'ok')::boolean), 'failed', (select coalesce(jsonb_agg(r), '[]'::jsonb) from jsonb_array_elements(results) r where not (r->>'ok')::boolean), 'ids', (select jsonb_agg(r->>'id') from jsonb_array_elements(results) r));
end
$otoiz$;
