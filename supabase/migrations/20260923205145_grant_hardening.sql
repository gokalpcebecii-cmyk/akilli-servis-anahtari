-- OTOİZ — Savunma derinliği: istemci rolleri denetim kaydına ve personel
-- tablosuna yazamaz (bu yazmalar yalnız sunucu/SECURITY DEFINER üzerinden).
-- Platform yönetici tablosu istemcilere tamamen kapalıdır.
revoke insert, update, delete on public.audit_log from anon, authenticated;
revoke insert, update, delete on public.staff_users from anon, authenticated;
revoke all on public.platform_admins from anon, authenticated;
revoke all on public.qr_keys from anon;
revoke insert, update, delete on public.qr_keys from authenticated;
