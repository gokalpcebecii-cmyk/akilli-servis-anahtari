-- OTOİZ P0 güvenlik paketi (staging önce):
--  1) Merkezi hız sınırı (rate limit) sayacı — yalnız service_role çağırır.
--  2) Servis başvurusu yalnız e-postası doğrulanmış, oturum açmış kullanıcı
--     tarafından ve yalnız kendisi için oluşturulabilir (auth.uid()).
--  3) Derin savunma: e-postası doğrulanmamış hesap onaylı servis olsa bile
--     hiçbir kiracı (tenant) verisine erişemez.

-- 1) Hız sınırı --------------------------------------------------------------
create table if not exists public.rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limit_counters to service_role;

-- Sabit pencereli sayaç: pencere içindeki istek sayısı p_max'ı aşarsa false.
-- Anahtar ham IP/e-posta değil, uygulamada üretilen sha256 özetidir.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 604800
     or p_max is null or p_max < 1 then
    raise exception 'rate_limit_hit: invalid arguments';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_counters as c (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = c.count + 1
  returning c.count into v_count;
  -- Eski pencereleri ara ara temizle (tablo küçük kalsın).
  if random() < 0.02 then
    delete from public.rate_limit_counters where window_start < now() - interval '8 days';
  end if;
  return v_count <= p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- 2) Servis başvurusu ----------------------------------------------------------
-- Çağıran: e-posta bağlantısıyla doğrulanmış ve oturum açmış kullanıcı.
-- Sonuç: tenant (approval_status = 'pending') + staff_users (owner).
-- OTOİZ yönetici onayı olmadan (approved_staff_tenant_ids) hiçbir araç/kayıt
-- işlemi yapılamaz — mevcut onay kapısı aynen geçerli.
create or replace function public.submit_service_application(
  p_business_name text,
  p_slug text,
  p_phone text,
  p_address text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_confirmed timestamptz;
  v_existing uuid;
  v_status text;
  v_tenant uuid;
  v_name text := btrim(coalesce(p_business_name, ''));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  select email_confirmed_at into v_confirmed from auth.users where id = v_uid;
  if v_confirmed is null then
    return jsonb_build_object('ok', false, 'code', 'email_not_confirmed');
  end if;

  -- Aynı kullanıcı ikinci kez başvurursa yeni işletme açılmaz (idempotent).
  select s.tenant_id, t.approval_status into v_existing, v_status
  from public.staff_users s join public.tenants t on t.id = s.tenant_id
  where s.id = v_uid;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'code', 'already_applied', 'approval_status', v_status);
  end if;

  -- Bireysel araç sahibi hesabı servis hesabına dönüştürülmez (roller karışmasın).
  if exists (select 1 from public.vehicles where owner_user_id = v_uid) then
    return jsonb_build_object('ok', false, 'code', 'individual_account');
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_business_name');
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]{3,80}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_slug');
  end if;
  if length(coalesce(p_phone, '')) > 40 or length(coalesce(p_address, '')) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid_contact');
  end if;

  insert into public.tenants (name, slug, phone, address, approval_status)
  values (v_name, p_slug, nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_address, '')), ''), 'pending')
  returning id into v_tenant;

  insert into public.staff_users (id, tenant_id, full_name, role)
  values (v_uid, v_tenant, v_name, 'owner');

  insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
  values (v_tenant, v_uid, 'service_application_submitted', 'tenants', v_tenant,
          jsonb_build_object('actor_user_id', v_uid));

  return jsonb_build_object('ok', true, 'code', 'submitted', 'approval_status', 'pending');
end;
$$;
revoke all on function public.submit_service_application(text, text, text, text) from public, anon;
grant execute on function public.submit_service_application(text, text, text, text) to authenticated, service_role;

-- 3) Derin savunma: onaylı servis kiracısı yalnız e-postası doğrulanmış hesaba açılır.
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
  join auth.users u on u.id = s.id
  where s.id = auth.uid()
    and t.approval_status = 'approved'
    and u.email_confirmed_at is not null
$$;
