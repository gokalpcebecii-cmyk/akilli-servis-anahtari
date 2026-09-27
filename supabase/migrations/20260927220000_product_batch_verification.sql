-- OTOİZ Aşama B — otomatik parti doğrulaması (Baskı Merkezi).
--
-- Yalnız EKLEMELİ: product_batches'e iki sütun + tek service_role
-- fonksiyonu. Mevcut veri, resolver, aktivasyon akışı değişmez.
--
-- admin_verify_product_batch(batch_id, tokens, codes, actor)
--   Veritabanı tarafındaki kontrolleri yapar ve sonucu
--   product_batches.verification'a (+ audit_log) yazar:
--     count_match      beklenen adet (quantity) = oluşan ürün
--     serial_unique    seri numaraları benzersiz, biçim OTZ-000000
--     serial_contiguous seri aralığı kesintisiz (uyarı; FAIL değil)
--     token_unique     26 karakter token'lar benzersiz ve biçimi doğru
--     batch_consistent tüm ürünler bu batch_id'de, etiket aynı
--     no_missing       seri/token/özet eksik ürün yok (aktivasyon öncesi)
--     code_match       (yalnız kodlar verilirse) her aktivasyon kodu kendi
--                      serisinin bcrypt özetiyle eşleşiyor
--   Kodlar YALNIZ parti üretim yanıtında düz metin olarak vardır; bu yüzden
--   code_match yalnız üretim anında ölçülür, sonraki yeniden
--   doğrulamalarda önceki sonuç korunur. Düz kod hiçbir yere yazılmaz.
--
--   Adres/alan adı, QR okunabilirliği ve PDF/SVG üretimi tarayıcıda
--   (Baskı Merkezi) doğrulanır ve p_client ile aynı kayda eklenir.
--
-- Geri dönüş: drop function admin_verify_product_batch;
--             alter table product_batches drop column verification, verified_at.

alter table public.product_batches
  add column if not exists verification jsonb,
  add column if not exists verified_at timestamptz;

create or replace function public.admin_verify_product_batch(
  p_batch_id uuid,
  p_tokens text[] default null,
  p_codes text[] default null,
  p_actor uuid default null,
  p_client jsonb default null
)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_batch public.product_batches%rowtype;
  v_n integer;
  v_serials integer;
  v_serial_ok integer;
  v_tokens integer;
  v_token_ok integer;
  v_other_batch integer;
  v_label_mismatch integer;
  v_missing integer;
  v_min integer;
  v_max integer;
  v_first text;
  v_last text;
  v_code_total integer;
  v_code_ok integer;
  v_code jsonb;
  v_prev jsonb;
  v_checks jsonb;
  v_server_ok boolean;
  v_client_ok boolean;
  v_result jsonb;
begin
  select * into v_batch from public.product_batches where id = p_batch_id;
  if not found then
    raise exception 'batch_not_found' using errcode = 'P0002';
  end if;
  v_prev := v_batch.verification;

  select count(*),
         count(distinct serial_no),
         count(*) filter (where serial_no ~ '^OTZ-[0-9]{6,}$'),
         count(distinct code),
         count(*) filter (where code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{26}$'),
         count(*) filter (where batch_label is distinct from v_batch.label),
         count(*) filter (where serial_no is null or code is null
                          or (status in ('created', 'in_stock', 'distributed') and activation_code_hash is null)),
         min(substring(serial_no from 5)::integer),
         max(substring(serial_no from 5)::integer),
         min(serial_no),
         max(serial_no)
    into v_n, v_serials, v_serial_ok, v_tokens, v_token_ok, v_label_mismatch, v_missing, v_min, v_max, v_first, v_last
    from public.qr_keys
   where batch_id = p_batch_id;

  -- Parti token'ları başka bir partide ya da partisiz satırda da var mı?
  -- (code UNIQUE olduğu için olamaz; yine de açıkça ölçülür.)
  select count(*) into v_other_batch
    from public.qr_keys a
    join public.qr_keys b on b.code = a.code and b.id <> a.id
   where a.batch_id = p_batch_id;

  if p_codes is not null then
    if p_tokens is null or cardinality(p_tokens) <> cardinality(p_codes) then
      raise exception 'tokens_codes_mismatch' using errcode = '22023';
    end if;
    select count(*),
           count(*) filter (where q.activation_code_hash is not null
                            and extensions.crypt(c.code, q.activation_code_hash) = q.activation_code_hash)
      into v_code_total, v_code_ok
      from unnest(p_tokens, p_codes) as c(token, code)
      left join public.qr_keys q on q.code = c.token and q.batch_id = p_batch_id;
    v_code := jsonb_build_object('ok', v_code_total = v_n and v_code_ok = v_n,
                                 'passed', v_code_ok, 'total', v_n, 'measured_at', now());
  else
    v_code := coalesce(v_prev -> 'checks' -> 'code_match',
                       jsonb_build_object('ok', null, 'passed', null, 'total', v_n, 'note', 'not_measured'));
  end if;

  v_checks := jsonb_build_object(
    'count_match',       jsonb_build_object('ok', v_n = v_batch.quantity, 'expected', v_batch.quantity, 'actual', v_n),
    'serial_unique',     jsonb_build_object('ok', v_serials = v_n and v_serial_ok = v_n, 'passed', least(v_serials, v_serial_ok), 'total', v_n),
    'serial_contiguous', jsonb_build_object('ok', v_n > 0 and v_max - v_min + 1 = v_n, 'warning_only', true),
    'token_unique',      jsonb_build_object('ok', v_tokens = v_n and v_token_ok = v_n and v_other_batch = 0, 'passed', least(v_tokens, v_token_ok), 'total', v_n, 'duplicates', (v_n - v_tokens) + v_other_batch),
    'batch_consistent',  jsonb_build_object('ok', v_label_mismatch = 0, 'mismatch', v_label_mismatch),
    'no_missing',        jsonb_build_object('ok', v_missing = 0, 'missing', v_missing),
    'code_match',        v_code
  );

  v_server_ok := v_n > 0
    and (v_checks #>> '{count_match,ok}')::boolean
    and (v_checks #>> '{serial_unique,ok}')::boolean
    and (v_checks #>> '{token_unique,ok}')::boolean
    and (v_checks #>> '{batch_consistent,ok}')::boolean
    and (v_checks #>> '{no_missing,ok}')::boolean
    and coalesce((v_code ->> 'ok')::boolean, false);

  -- Tarayıcı kontrolleri (adres, QR okuma, dosya üretimi). Verilmezse önceki
  -- sonuç korunur.
  if p_client is null then
    p_client := v_prev -> 'client';
  end if;
  v_client_ok := coalesce((p_client ->> 'ok')::boolean, false);

  v_result := jsonb_build_object(
    'ready', v_server_ok and v_client_ok,
    'server_ok', v_server_ok,
    'client_ok', v_client_ok,
    'count', v_n,
    'serial_first', v_first,
    'serial_last', v_last,
    'checks', v_checks,
    'client', p_client,
    'verified_at', now()
  );

  update public.product_batches
     set verification = v_result, verified_at = now()
   where id = p_batch_id;

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (null, null, 'product_batch_verified', 'product_batches', p_batch_id,
          jsonb_build_object('ready', v_server_ok and v_client_ok, 'server_ok', v_server_ok,
                             'client_ok', v_client_ok, 'count', v_n,
                             'code_match_measured', p_codes is not null,
                             'actor_user_id', p_actor, 'via', 'admin_panel'));

  return v_result;
end;
$function$;
revoke all on function public.admin_verify_product_batch(uuid, text[], text[], uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_verify_product_batch(uuid, text[], text[], uuid, jsonb) to service_role;
