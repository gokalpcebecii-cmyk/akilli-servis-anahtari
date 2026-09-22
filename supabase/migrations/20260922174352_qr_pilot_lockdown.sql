-- P0 fix 1+2: remove cross-tenant pool exposure and unauthorized pool-claiming on qr_keys.
-- P0/B5: qr_keys INSERT/UPDATE/DELETE becomes service_role-only during pilot closure
-- (matches PILOT_FLAGS.bulkQrGeneration=false / qrMatchingSelfService=false / the new
-- qrSelfIssuance=false gate being added to lib/pilotFlags.ts in this same round).

drop policy "owner_insert_own_vehicle_qr_keys" on public.qr_keys;
drop policy "owner_update_own_vehicle_qr_keys" on public.qr_keys;
drop policy "staff_update_own_tenant_qr_keys" on public.qr_keys;
drop policy "staff_select_own_tenant_or_pool_qr_keys" on public.qr_keys;

-- Narrow replacement: staff may only SELECT QR codes already assigned to
-- their own tenant's vehicles — no visibility into the unassigned pool.
create policy "staff_select_own_tenant_qr_keys" on public.qr_keys
  as permissive for select to authenticated
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))));

-- owner_select_own_vehicle_qr_keys is left untouched — narrow, read-only, already correct.

-- Grant-layer enforcement (belt-and-suspenders alongside RLS): remove all
-- client-side write paths on qr_keys; only the service_role (server API
-- routes app/api/qr-uretim, app/api/qr-eslestir) may write.
revoke insert, update, delete on public.qr_keys from anon, authenticated;
