-- OTOİZ — QR denetim kaydı: tüm QR yazmaları artık yalnız sunucu (service_role)
-- üzerinden ve aktörü/kaynağı açık, ayrıntılı audit_log kaydıyla yapılıyor
-- (admin_qr_*, servis_panel, bireysel_uygulama). Tetikleyiciler yalnız oturumlu
-- bir kullanıcı bağlamında (auth.uid() dolu) ek kayıt yazar; aksi halde aynı
-- olay iki kez sayılırdı.
create or replace function public.log_qr_key_assigned()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_staff_id uuid;
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.vehicle_id is not null and (tg_op = 'INSERT' or old.vehicle_id is distinct from new.vehicle_id) then
    select id into v_staff_id from public.staff_users where id = auth.uid();
    select tenant_id into v_tenant_id from public.vehicles where id = new.vehicle_id;
    insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
    values (v_tenant_id, v_staff_id, 'qr_key_assigned', 'qr_keys', new.id,
            jsonb_build_object('vehicle_id', new.vehicle_id, 'actor_user_id', auth.uid()));
  end if;
  return new;
end;
$function$;

create or replace function public.log_qr_key_revoked()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_staff_id uuid;
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.revoked_at is null and new.revoked_at is not null then
    select id into v_staff_id from public.staff_users where id = auth.uid();
    select tenant_id into v_tenant_id from public.vehicles where id = new.vehicle_id;
    insert into public.audit_log (tenant_id, actor_staff_id, action, target_table, target_id, detail)
    values (v_tenant_id, v_staff_id, 'qr_key_revoked', 'qr_keys', new.id,
            jsonb_build_object('vehicle_id', new.vehicle_id, 'actor_user_id', auth.uid()));
  end if;
  return new;
end;
$function$;

-- İptal edilmiş bir QR hiçbir koşulda yeniden bir araca bağlanamaz ya da
-- iptali geri alınamaz (veritabanı seviyesinde son savunma hattı).
create or replace function public.guard_qr_key_revoked()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if old.revoked_at is not null then
    if new.revoked_at is null then
      raise exception 'qr_revoked_immutable' using errcode = '42501';
    end if;
    if new.vehicle_id is distinct from old.vehicle_id then
      raise exception 'qr_revoked_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_guard_qr_key_revoked on public.qr_keys;
create trigger trg_guard_qr_key_revoked before update on public.qr_keys
  for each row execute function public.guard_qr_key_revoked();
revoke all on function public.guard_qr_key_revoked() from public, anon, authenticated;
