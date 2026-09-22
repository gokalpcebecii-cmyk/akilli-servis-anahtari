-- OTOİZ — 2026-09-23 staging (ctltjunojlaanzurxpzy)
--
-- Bulgu 7 (orta): "public_read_tenant_branding" USING (true) → giriş yapmış
-- HER kullanıcı tüm servislerin telefon/adres bilgisini okuyabiliyordu.
-- Uygulamada tenants'ı okuyan istemci yolları yalnız servis personelinin
-- kendi kaydı (tenants_select_own) ve service_role'dür (reminders, signup);
-- halka açık pasaport SECURITY DEFINER RPC üzerinden okur. Politika kaldırıldı.
--
-- Yeni bulgu (işlev): tenants üzerinde UPDATE politikası yoktu → Servis
-- Ayarları "Kaydedildi" diyor ama hiçbir şey kaydedilmiyordu. Yalnız
-- işletme sahibi (staff_users.role = 'owner') kendi tenant'ının marka ve
-- iletişim alanlarını güncelleyebilir; is_active/slug gibi alanlar
-- sütun-seviyesi grant ile kapalı.

drop policy if exists "public_read_tenant_branding" on public.tenants;

create policy "tenants_update_own_by_owner" on public.tenants as permissive for update to authenticated
  using (id in (select s.tenant_id from public.staff_users s where s.id = auth.uid() and s.role = 'owner'))
  with check (id in (select s.tenant_id from public.staff_users s where s.id = auth.uid() and s.role = 'owner'));

revoke insert, update, delete on public.tenants from authenticated;
grant update (name, logo_url, primary_color, secondary_color, phone, address, website_url, reminder_days_before, reminder_km_before) on public.tenants to authenticated;
