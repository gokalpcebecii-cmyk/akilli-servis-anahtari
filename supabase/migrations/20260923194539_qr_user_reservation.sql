-- OTOİZ — 2026-09-23: Bireysel satış. Yönetici, ürettiği QR kodunu servis
-- yerine doğrudan bir BİREYSEL kullanıcıya tanımlayabilir; kullanıcı bu kodu
-- kendi aracına bağlar (app/api/bireysel/qr). Bir kod aynı anda ya bir
-- servise ya bir kullanıcıya ayrılabilir. qr_keys istemci rollerine yazmaya
-- kapalı kalır; tüm yazmalar sunucu (service_role) üzerinden.
alter table public.qr_keys add column if not exists reserved_user_id uuid references auth.users(id) on delete set null;
alter table public.qr_keys drop constraint if exists qr_keys_single_reservation;
alter table public.qr_keys add constraint qr_keys_single_reservation check (reserved_tenant_id is null or reserved_user_id is null);
create index if not exists qr_keys_reserved_user_idx on public.qr_keys (reserved_user_id) where reserved_user_id is not null;
