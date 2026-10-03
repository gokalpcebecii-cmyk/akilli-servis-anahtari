-- OTOİZ — Belge modülü kapanış: izinli dosya türleri yalnız PDF, JPG/JPEG,
-- PNG ve HEIC/HEIF (proje sahibi kararı). WEBP çıkarıldı. Kova özel kalır,
-- 10 MB sınırı aynı. Mevcut veri değişmez (webp belge yoksa geçer; varsa
-- migration durur ve hiçbir şey değişmez).

alter table public.vehicle_documents drop constraint if exists vehicle_documents_mime_type_check;
alter table public.vehicle_documents add constraint vehicle_documents_mime_type_check
  check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'));

update storage.buckets
   set public = false,
       file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
 where id = 'vehicle-documents';
