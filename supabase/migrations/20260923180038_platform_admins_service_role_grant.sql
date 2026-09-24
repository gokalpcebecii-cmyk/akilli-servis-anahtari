-- OTOİZ — 2026-09-24 staging: platform_admins yeni tablo; bu projede varsayılan
-- yetkiler service_role'e SELECT vermiyordu → yönetici kontrolü hep "forbidden"
-- dönüyordu. Yalnız service_role (sunucu) okuyup yazabilir.
grant select, insert, update, delete on public.platform_admins to service_role;
