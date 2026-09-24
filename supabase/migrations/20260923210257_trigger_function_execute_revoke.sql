-- OTOİZ — Tetikleyici fonksiyonları doğrudan RPC olarak çağrılamaz; istemci
-- rollerinin EXECUTE yetkisi her ortamda açıkça kaldırılır (ortamlar arası
-- varsayılan yetki farklarını da eşitler — migration zinciri deterministik).
revoke all on function public.log_ownership_transfer() from public, anon, authenticated;
revoke all on function public.log_qr_key_assigned() from public, anon, authenticated;
revoke all on function public.log_qr_key_revoked() from public, anon, authenticated;
revoke all on function public.log_vehicle_created() from public, anon, authenticated;
revoke all on function public.guard_vehicle_tenant_change() from public, anon, authenticated;
revoke all on function public.guard_qr_key_revoked() from public, anon, authenticated;
