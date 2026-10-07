-- OTOİZ — E–H seçimli belge devri, veritabanı katmanı kabul testleri.
-- Tek DO bloğu; sonunda bilinçli exception ile TÜM değişiklikler (test
-- kullanıcıları, araçlar, belgeler, devirler, yardımcı şema) geri alınır.
-- Sonuç: 'OTOIZ_TEST_RESULTS [...]' hata mesajında döner.
-- Yerelde tests/belgeDevri.test.js çalıştırır; staging'de aynen çalıştırılabilir.
do $otoiz$
declare
  A  uuid := '0e0e0e0e-0000-4000-8000-0000000000a1';  -- eski sahip
  B  uuid := '0e0e0e0e-0000-4000-8000-0000000000b1';  -- alıcı (yeni sahip)
  C  uuid := '0e0e0e0e-0000-4000-8000-0000000000c1';  -- üçüncü kişi
  V  uuid := '0e0e0e0e-0000-4000-8000-0000000000e1';  -- devredilen araç
  W  uuid := '0e0e0e0e-0000-4000-8000-0000000000e2';  -- C'nin aracı
  DA uuid := '0e0e0e0e-0000-4000-8000-0000000000d1';  -- seçilecek belge
  DB uuid := '0e0e0e0e-0000-4000-8000-0000000000d2';  -- seçilmeyecek belge
  DX uuid := '0e0e0e0e-0000-4000-8000-0000000000d9';  -- C'nin belgesi (enjeksiyon)
  results jsonb := '[]'::jsonb;
  j jsonb; e text; n int; t_tok text; t_id uuid; ok boolean;
begin
  -- Yardımcılar: belirli kullanıcı olarak (authenticated rolü + JWT sub) sorgu.
  execute 'create schema otz_test';
  execute $f$create function otz_test.cnt(p_uid uuid, p_sql text) returns int language plpgsql as $b$
    declare r int; begin
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute p_sql into r;
      execute 'reset role';
      perform set_config('request.jwt.claims', '', true);
      return r; end $b$$f$;
  execute $f$create function otz_test.js(p_uid uuid, p_sql text) returns jsonb language plpgsql as $b$
    declare r jsonb; begin
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute p_sql into r;
      execute 'reset role';
      perform set_config('request.jwt.claims', '', true);
      return r; end $b$$f$;
  execute $f$create function otz_test.err(p_uid uuid, p_sql text) returns text language plpgsql as $b$
    begin
      begin
        perform otz_test.js(p_uid, p_sql);
      exception when others then
        return sqlerrm;
      end;
      return null; end $b$$f$;

  -- Tohum veri (süper kullanıcı olarak)
  insert into auth.users (id, email, email_confirmed_at) values
    (A, 'eh-eski-sahip@example.test', now()), (B, 'eh-alici@example.test', now()), (C, 'eh-ucuncu@example.test', now());
  insert into public.vehicles (id, plate, current_km, owner_user_id) values
    (V, '99 EH 001', 50000, A), (W, '99 EH 002', 1000, C);
  insert into public.maintenance_records (vehicle_id, tenant_id, service_date, km_at_service, description, created_by) values
    (V, null, current_date - 100, 40000, 'Motor yağı', null),
    (V, null, current_date - 10, 49000, 'Fren balatası', null);
  insert into public.vehicle_documents (id, vehicle_id, uploaded_by, doc_type, storage_path, file_name, mime_type, size_bytes) values
    (DA, V, A, 'servis_fisi', V::text || '/eh-a.pdf', 'servis-fisi.pdf', 'application/pdf', 1000),
    (DB, V, A, 'fatura',      V::text || '/eh-b.pdf', 'kisisel-fatura.pdf', 'application/pdf', 1000),
    (DX, W, C, 'fatura',      W::text || '/eh-x.pdf', 'baskasinin.pdf', 'application/pdf', 1000);
  insert into storage.objects (bucket_id, name, owner_id) values
    ('vehicle-documents', V::text || '/eh-a.pdf', A::text),
    ('vehicle-documents', V::text || '/eh-b.pdf', A::text);

  -- E1: devir ekranının kaynağı: eski sahip aracın gerçek belgelerini görür (2).
  n := otz_test.cnt(A, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','E1','desc','Devir ekranı kaynağı: A ve B belgeleri backendden geliyor (2 belge)','ok', n = 2, 'got', n);

  -- SECURITY: geçersiz/enjekte kimlikler reddedilir, devir oluşmaz.
  e := otz_test.err(A, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid])', V, DX));
  n := (select count(*) from public.ownership_transfers where vehicle_id = V);
  results := results || jsonb_build_object('id','SEC-1','desc','Başka kullanıcının/aracın document_id''si reddedilir, devir oluşmaz','ok', e like '%invalid_document%' and n = 0, 'got', e);
  e := otz_test.err(A, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid])', V, gen_random_uuid()));
  results := results || jsonb_build_object('id','SEC-2','desc','Var olmayan document_id reddedilir','ok', e like '%invalid_document%', 'got', e);
  e := otz_test.err(A, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid, null])', V, DA));
  results := results || jsonb_build_object('id','SEC-3','desc','NULL içeren seçim reddedilir','ok', e like '%invalid_document%', 'got', e);
  e := otz_test.err(C, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid])', V, DA));
  results := results || jsonb_build_object('id','SEC-4','desc','Aracın sahibi olmayan devir başlatamaz','ok', e like '%forbidden%', 'got', e);
  e := otz_test.err(B, format('insert into public.ownership_transfer_documents (transfer_id, document_id, vehicle_id) values (gen_random_uuid(), %L, %L) returning null::jsonb', DA, V));
  results := results || jsonb_build_object('id','SEC-5','desc','İstemci ownership_transfer_documents tablosuna doğrudan yazamaz','ok', e like '%permission denied%', 'got', e);
  e := otz_test.err(B, 'select count(*)::text::jsonb from public.ownership_transfer_documents');
  results := results || jsonb_build_object('id','SEC-6','desc','İstemci ownership_transfer_documents tablosunu okuyamaz','ok', e like '%permission denied%', 'got', e);
  ok := (select owner_user_id from public.vehicles where id = V) = A;
  results := results || jsonb_build_object('id','SEC-7','desc','Reddedilen denemeler aracın sahipliğini değiştirmedi','ok', ok);

  -- H1: PENDING
  j := otz_test.js(A, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid])', V, DA));
  t_tok := j->>'token'; t_id := (j->>'transfer_id')::uuid;
  n := otz_test.cnt(B, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','H1','desc','PENDING: alıcı hiçbir belge göremez','ok', n = 0, 'got', n);
  n := otz_test.cnt(A, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','H1-OWNER','desc','PENDING: eski sahibin belge erişimi değişmez (2)','ok', n = 2, 'got', n);
  j := otz_test.js(B, format('select public.preview_ownership_transfer(%L)', t_tok));
  results := results || jsonb_build_object('id','H1-PREVIEW','desc','PENDING: alıcı önizlemede yalnız belge SAYISINI görür (1)','ok', (j->>'document_count')::int = 1 and j->>'plate' = '99 EH 001', 'got', j->'document_count');

  -- H3: CANCEL
  perform otz_test.js(A, format('select public.cancel_ownership_transfer(%L::uuid)', t_id));
  n := otz_test.cnt(B, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  e := otz_test.err(B, format('select public.accept_ownership_transfer(%L)', t_tok));
  results := results || jsonb_build_object('id','H3','desc','CANCEL: alıcı belge göremez, iptal edilen devri kabul edemez','ok', n = 0 and e is not null, 'got', jsonb_build_object('count', n, 'accept_err', e));
  n := otz_test.cnt(A, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','H3-OWNER','desc','CANCEL: eski sahip aracı ve 2 belgesini geri alır','ok', n = 2 and (select owner_user_id from public.vehicles where id = V) = A, 'got', n);

  -- H2: REJECT
  j := otz_test.js(A, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid])', V, DA));
  t_tok := j->>'token'; t_id := (j->>'transfer_id')::uuid;
  perform otz_test.js(B, format('select public.reject_ownership_transfer(%L)', t_tok));
  n := otz_test.cnt(B, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  e := otz_test.err(B, format('select public.accept_ownership_transfer(%L)', t_tok));
  results := results || jsonb_build_object('id','H2','desc','REJECT: alıcı belge göremez, reddedilen devri sonradan kabul edemez','ok', n = 0 and e is not null, 'got', jsonb_build_object('count', n, 'accept_err', e));
  n := otz_test.cnt(A, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  e := otz_test.err(A, format('select public.cancel_ownership_transfer(%L::uuid)', t_id));
  results := results || jsonb_build_object('id','H2-OWNER','desc','REJECT: araç ve 2 belge eski sahibe döner; devir artık iptal edilemez','ok', n = 2 and (select owner_user_id from public.vehicles where id = V) = A and e like '%already_rejected%', 'got', n);

  -- H4: EXPIRE
  j := otz_test.js(A, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid])', V, DA));
  t_tok := j->>'token'; t_id := (j->>'transfer_id')::uuid;
  update public.ownership_transfers set token_expires_at = now() - interval '1 minute' where id = t_id;
  e := otz_test.err(B, format('select public.accept_ownership_transfer(%L)', t_tok));
  n := otz_test.cnt(B, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','H4','desc','EXPIRE: süresi dolan devir kabul edilemez, alıcı belge göremez','ok', e like '%expired%' and n = 0, 'got', jsonb_build_object('count', n, 'accept_err', e));
  n := otz_test.cnt(A, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  perform otz_test.js(A, format('select public.cancel_ownership_transfer(%L::uuid)', t_id));
  results := results || jsonb_build_object('id','H4-OWNER','desc','EXPIRE: eski sahip belgelerini görmeye devam eder (2), iptalle aracı geri alır','ok', n = 2 and (select owner_user_id from public.vehicles where id = V) = A, 'got', n);

  -- E2: yalnız A seçilir; ilişki tablosunda yalnız A
  j := otz_test.js(A, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid, %L::uuid])', V, DA, DA));
  t_tok := j->>'token'; t_id := (j->>'transfer_id')::uuid;
  results := results || jsonb_build_object('id','E2','desc','Yalnız A seçildi: ownership_transfer_documents yalnız A içerir (tekrar eden kimlik tek satır)','ok',
    (select array_agg(document_id) from public.ownership_transfer_documents where transfer_id = t_id) = array[DA] and (j->>'document_count')::int = 1,
    'got', (select jsonb_agg(document_id) from public.ownership_transfer_documents where transfer_id = t_id));
  begin
    insert into public.ownership_transfer_documents (transfer_id, document_id, vehicle_id) values (t_id, DA, V);
    ok := false;
  exception when unique_violation then ok := true;
  end;
  results := results || jsonb_build_object('id','E2-UNIQUE','desc','transfer_id + document_id UNIQUE','ok', ok);
  begin
    insert into public.ownership_transfer_documents (transfer_id, document_id, vehicle_id) values (t_id, DX, V);
    ok := false;
  exception when foreign_key_violation then ok := true;
  end;
  results := results || jsonb_build_object('id','E2-FK','desc','Başka araca ait belge, servis rolüyle bile devre bağlanamaz (bileşik FK)','ok', ok);

  -- ACCEPT
  j := otz_test.js(B, format('select public.accept_ownership_transfer(%L)', t_tok));
  results := results || jsonb_build_object('id','ACCEPT','desc','Alıcı devri kabul eder','ok', (j->>'ok')::boolean and (select owner_user_id from public.vehicles where id = V) = B, 'got', j);

  -- F1 / G1: metadata
  n := otz_test.cnt(B, format('select count(*) from public.vehicle_documents where id = %L', DA));
  results := results || jsonb_build_object('id','F1','desc','ACCEPT sonrası yeni sahip A metadata okuyabilir','ok', n = 1, 'got', n);
  n := otz_test.cnt(B, format('select count(*) from public.vehicle_documents where id = %L', DB));
  results := results || jsonb_build_object('id','G1','desc','ACCEPT sonrası yeni sahip B metadata okuyamaz','ok', n = 0, 'got', n);
  n := otz_test.cnt(B, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','F1-LIST','desc','Yeni sahibin araç belge listesinde yalnız A var','ok', n = 1, 'got', n);

  -- Dosya katmanı: yol bilmek erişim sağlamaz (depolama politikaları genişletilmedi)
  n := otz_test.cnt(B, format('select count(*) from storage.objects where bucket_id = %L and name in (%L, %L)', 'vehicle-documents', V::text || '/eh-a.pdf', V::text || '/eh-b.pdf'));
  results := results || jsonb_build_object('id','PATH','desc','Yeni sahip dosya yolunu bilse de depolamadan doğrudan okuyamaz (A dahil; A yalnız sunucu imzalı bağlantısıyla)','ok', n = 0, 'got', n);
  n := otz_test.cnt(B, format('delete from public.vehicle_documents where id = %L returning 1', DA));
  results := results || jsonb_build_object('id','F1-NODELETE','desc','Yeni sahip devralınan belgeyi silemez (yalnız yükleyen)','ok', coalesce(n, 0) = 0 and exists (select 1 from public.vehicle_documents where id = DA));

  -- OWNER: eski sahip araç erişimini kaybeder
  n := otz_test.cnt(A, format('select count(*) from public.vehicles where id = %L', V));
  results := results || jsonb_build_object('id','OWNER','desc','ACCEPT sonrası eski sahip araca erişemez','ok', n = 0, 'got', n);
  n := otz_test.cnt(A, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V))
     + otz_test.cnt(A, format('select count(*) from public.maintenance_records where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','OWNER-DOCS','desc','ACCEPT sonrası eski sahip bu aracın belge/bakım kayıtlarına erişemez','ok', n = 0, 'got', n);

  -- HISTORY: yeni sahip bakım geçmişini vehicle_id üzerinden görür
  n := otz_test.cnt(B, format('select count(*) from public.maintenance_records where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','HISTORY','desc','Yeni sahip araç bakım geçmişini görür (2 kayıt)','ok', n = 2, 'got', n);

  -- Üçüncü kişi hiçbir şey göremez
  n := otz_test.cnt(C, format('select count(*) from public.vehicle_documents where vehicle_id = %L', V));
  results := results || jsonb_build_object('id','THIRD','desc','Üçüncü kişi araç belgelerini göremez','ok', n = 0, 'got', n);

  -- İkinci devir: B yalnız erişimi olan belgeyi (A) aktarabilir, B'yi (DB) aktaramaz
  e := otz_test.err(B, format('select public.initiate_ownership_transfer(%L::uuid, array[%L::uuid])', V, DB));
  results := results || jsonb_build_object('id','SEC-8','desc','Yeni sahip kendisine aktarılmamış belgeyi tekrar devredemez','ok', e like '%invalid_document%', 'got', e);

  -- Eski çağrı biçimi (belgesiz) çalışmaya devam eder
  j := otz_test.js(B, format('select public.initiate_ownership_transfer(%L::uuid)', V));
  results := results || jsonb_build_object('id','COMPAT','desc','Belge parametresiz eski devir çağrısı çalışır, 0 belge aktarılır','ok', (j->>'document_count')::int = 0 and j->>'token' is not null, 'got', j->'document_count');

  raise exception 'OTOIZ_TEST_RESULTS %', results::text;
end;
$otoiz$;
