-- OTOİZ — 2026-09-24 staging: hızlı bakıma yeni kalemler (Fren Diski, Buji, Silecek).
alter table public.maintenance_items drop constraint maintenance_items_item_key_check;
alter table public.maintenance_items add constraint maintenance_items_item_key_check check (item_key = any (array[
  'motor_yagi','yag_filtresi','hava_filtresi','polen_filtresi','fren_disk_balata','triger_seti','aku','lastik',
  'fren_on_balata','fren_arka_balata','fren_diski','buji','silecek'
]::text[]));
