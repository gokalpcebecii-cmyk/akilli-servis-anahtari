-- OTOİZ 04A-S — safe schema baseline, part 3/5
-- Staging ONLY (ctltjunojlaanzurxpzy / akilli-servis-anahtari-staging).
-- NOTE: this is a faithful, as-applied historical record of Production's
-- policies at baseline time, INCLUDING the qr_keys P0 exposures later
-- closed by migration 20260922180000_qr_pilot_lockdown.sql. Do not edit
-- this file to "fix" them — security fixes are forward migrations only.

-- Enable RLS (not forced) on all 11 tables, matching Production exactly
alter table public.audit_log enable row level security;
alter table public.customers enable row level security;
alter table public.data_deletion_requests enable row level security;
alter table public.kvkk_consents enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.ownership_transfers enable row level security;
alter table public.qr_keys enable row level security;
alter table public.staff_users enable row level security;
alter table public.tenants enable row level security;
alter table public.vehicles enable row level security;

-- audit_log
create policy "owner_select_own_vehicle_audit_log" on public.audit_log
  as permissive for select to public
  using (((target_table = 'vehicles'::text) AND (target_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())))) OR ((detail ->> 'actor_user_id'::text) = (auth.uid())::text));

create policy "staff_own_tenant_audit_log" on public.audit_log
  as permissive for select to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- customers
create policy "staff_select_own_tenant_customers" on public.customers
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- data_deletion_requests
create policy "staff_own_tenant_deletion_requests" on public.data_deletion_requests
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- kvkk_consents
create policy "staff_own_tenant_consents" on public.kvkk_consents
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- maintenance_items
create policy "Servis kendi işletmesinin bakım kalemlerini düzenleyebilir" on public.maintenance_items
  as permissive for all to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))));

create policy "Servis kendi işletmesinin bakım kalemlerini görebilir" on public.maintenance_items
  as permissive for select to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))));

create policy "owner_modify_own_vehicle_items" on public.maintenance_items
  as permissive for all to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "owner_select_own_vehicle_items" on public.maintenance_items
  as permissive for select to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

-- maintenance_records
create policy "owner_insert_own_vehicle_records" on public.maintenance_records
  as permissive for insert to public
  with check (((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid()))) AND (tenant_id IS NULL)));

create policy "owner_select_own_vehicle_records" on public.maintenance_records
  as permissive for select to public
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "staff_modify_own_tenant_records" on public.maintenance_records
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))
  with check (((tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid()))) AND (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))))));

create policy "staff_select_own_tenant_records" on public.maintenance_records
  as permissive for select to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- ownership_transfers
create policy "owner_manage_own_vehicle_transfers" on public.ownership_transfers
  as permissive for all to public
  using (((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid()))) OR (previous_owner_user_id = auth.uid()) OR (new_owner_user_id = auth.uid())))
  with check (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "staff_own_tenant_transfers" on public.ownership_transfers
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- qr_keys (as-applied baseline — P0 exposures here closed by migration 6, see note above)
create policy "owner_insert_own_vehicle_qr_keys" on public.qr_keys
  as permissive for insert to authenticated
  with check (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "owner_select_own_vehicle_qr_keys" on public.qr_keys
  as permissive for select to authenticated
  using (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "owner_update_own_vehicle_qr_keys" on public.qr_keys
  as permissive for update to authenticated
  using (((revoked_at IS NULL) AND (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())))))
  with check (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.owner_user_id = auth.uid())));

create policy "staff_select_own_tenant_or_pool_qr_keys" on public.qr_keys
  as permissive for select to authenticated
  using (((vehicle_id IS NULL) OR (vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())))))));

create policy "staff_update_own_tenant_qr_keys" on public.qr_keys
  as permissive for update to authenticated
  using (((revoked_at IS NULL) AND ((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid()))))) OR (vehicle_id IS NULL))))
  with check (((revoked_at IS NULL) AND ((vehicle_id IN ( SELECT vehicles.id FROM vehicles WHERE (vehicles.tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid()))))) OR (vehicle_id IS NULL))));

-- staff_users
create policy "staff_select_own_row" on public.staff_users
  as permissive for select to public
  using (id = auth.uid());

-- tenants
create policy "public_read_tenant_branding" on public.tenants
  as permissive for select to public
  using (true);

create policy "tenants_select_own" on public.tenants
  as permissive for select to public
  using (id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

-- vehicles
create policy "owner_modify_own_vehicles" on public.vehicles
  as permissive for all to public
  using (owner_user_id = auth.uid());

create policy "owner_select_own_vehicles" on public.vehicles
  as permissive for select to public
  using (owner_user_id = auth.uid());

create policy "staff_modify_own_tenant_vehicles" on public.vehicles
  as permissive for all to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));

create policy "staff_select_own_tenant_vehicles" on public.vehicles
  as permissive for select to public
  using (tenant_id IN ( SELECT staff_users.tenant_id FROM staff_users WHERE (staff_users.id = auth.uid())));
