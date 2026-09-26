-- Faz 3 düzeltme: admin_create_product_batch service_role ile çalışır ve seri
-- numarası için sıraya erişmesi gerekir. İstemci rollerine kapalı kalır.
grant usage, select on sequence public.product_serial_seq to service_role;
