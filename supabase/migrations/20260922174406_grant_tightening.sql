-- P0 fix 3: TRUNCATE/TRIGGER/REFERENCES are never needed by app-level
-- roles and RLS provides zero protection against TRUNCATE (it bypasses
-- row security entirely). Remove from anon AND authenticated on all 11
-- tables. service_role is never touched (C4).

revoke truncate, trigger, references on public.audit_log from anon, authenticated;
revoke truncate, trigger, references on public.customers from anon, authenticated;
revoke truncate, trigger, references on public.data_deletion_requests from anon, authenticated;
revoke truncate, trigger, references on public.kvkk_consents from anon, authenticated;
revoke truncate, trigger, references on public.maintenance_items from anon, authenticated;
revoke truncate, trigger, references on public.maintenance_records from anon, authenticated;
revoke truncate, trigger, references on public.ownership_transfers from anon, authenticated;
revoke truncate, trigger, references on public.qr_keys from anon, authenticated;
revoke truncate, trigger, references on public.staff_users from anon, authenticated;
revoke truncate, trigger, references on public.tenants from anon, authenticated;
revoke truncate, trigger, references on public.vehicles from anon, authenticated;

-- Code audit (this round) confirmed anon never performs direct table
-- reads/writes anywhere in the app — its only legitimate access paths
-- are the two SECURITY DEFINER RPCs (get_public_vehicle_passport,
-- preview_ownership_transfer). Remove anon's remaining base-table
-- privileges entirely; RLS stays as-is for authenticated/service_role.
revoke all on public.audit_log from anon;
revoke all on public.customers from anon;
revoke all on public.data_deletion_requests from anon;
revoke all on public.kvkk_consents from anon;
revoke all on public.maintenance_items from anon;
revoke all on public.maintenance_records from anon;
revoke all on public.ownership_transfers from anon;
revoke all on public.qr_keys from anon;
revoke all on public.staff_users from anon;
revoke all on public.tenants from anon;
revoke all on public.vehicles from anon;
