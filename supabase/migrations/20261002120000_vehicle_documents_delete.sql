-- OTOİZ pilot final — Belge SİLME yetkileri.
-- Önceki belge migration'ında (20260930142256) yalnız select/insert vardı;
-- kullanıcı kendi belgesini SİLEMEZDI. Bu migration: kullanıcı yalnız kendi
-- yüklediği belgeyi, aracın güncel sahibi olduğu sürece silebilir. Devir
-- sonrası eski sahip kendi eski belgesini bile SİLEMEZ (sahiplik koşulu).
-- Hiçbir veri taşınmaz, hiçbir kolon değişmez — yalnız grant + policy.

revoke all on table public.vehicle_documents from public, anon, authenticated;
grant select, insert, delete on table public.vehicle_documents to authenticated;

drop policy if exists owner_delete_own_documents on public.vehicle_documents;
create policy owner_delete_own_documents on public.vehicle_documents
  for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    and vehicle_id in (select v.id from public.vehicles v where v.owner_user_id = (select auth.uid()))
  );

-- Depolama: yalnız kendi klasöründeki (ve kendi yüklediğin) dosyayı silebilirsin.
drop policy if exists otoiz_vehicle_documents_delete on storage.objects;
create policy otoiz_vehicle_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] in (select v.id::text from public.vehicles v where v.owner_user_id = (select auth.uid()))
  );
