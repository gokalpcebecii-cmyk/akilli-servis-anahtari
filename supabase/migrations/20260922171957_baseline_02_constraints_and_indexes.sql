-- OTOİZ 04A-S — safe schema baseline, part 2/5
-- Staging ONLY (ctltjunojlaanzurxpzy / akilli-servis-anahtari-staging).

-- Primary keys
alter table public.tenants add constraint tenants_pkey primary key (id);
alter table public.staff_users add constraint staff_users_pkey primary key (id);
alter table public.customers add constraint customers_pkey primary key (id);
alter table public.vehicles add constraint vehicles_pkey primary key (id);
alter table public.maintenance_items add constraint maintenance_items_pkey primary key (id);
alter table public.maintenance_records add constraint maintenance_records_pkey primary key (id);
alter table public.qr_keys add constraint qr_keys_pkey primary key (id);
alter table public.ownership_transfers add constraint ownership_transfers_pkey primary key (id);
alter table public.kvkk_consents add constraint kvkk_consents_pkey primary key (id);
alter table public.data_deletion_requests add constraint data_deletion_requests_pkey primary key (id);
alter table public.audit_log add constraint audit_log_pkey primary key (id);

-- Unique constraints
alter table public.tenants add constraint tenants_slug_key unique (slug);
alter table public.maintenance_items add constraint maintenance_items_vehicle_id_item_key_key unique (vehicle_id, item_key);
alter table public.qr_keys add constraint qr_keys_code_key unique (code);
alter table public.ownership_transfers add constraint ownership_transfers_transfer_token_key unique (transfer_token);

-- Check constraints
alter table public.maintenance_items add constraint maintenance_items_item_key_check check (item_key = ANY (ARRAY['motor_yagi'::text, 'yag_filtresi'::text, 'hava_filtresi'::text, 'polen_filtresi'::text, 'fren_disk_balata'::text, 'triger_seti'::text, 'aku'::text, 'lastik'::text, 'fren_on_balata'::text, 'fren_arka_balata'::text]));

-- Foreign keys
alter table public.staff_users add constraint staff_users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.staff_users add constraint staff_users_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.customers add constraint customers_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.vehicles add constraint vehicles_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.vehicles add constraint vehicles_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete set null;
alter table public.vehicles add constraint vehicles_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id);

alter table public.maintenance_items add constraint maintenance_items_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete cascade;

alter table public.maintenance_records add constraint maintenance_records_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete cascade;
alter table public.maintenance_records add constraint maintenance_records_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.maintenance_records add constraint maintenance_records_created_by_fkey foreign key (created_by) references auth.users(id);

alter table public.qr_keys add constraint qr_keys_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete set null;

alter table public.ownership_transfers add constraint ownership_transfers_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete cascade;
alter table public.ownership_transfers add constraint ownership_transfers_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.ownership_transfers add constraint ownership_transfers_new_customer_id_fkey foreign key (new_customer_id) references public.customers(id) on delete set null;
alter table public.ownership_transfers add constraint ownership_transfers_performed_by_fkey foreign key (performed_by) references public.staff_users(id);
alter table public.ownership_transfers add constraint ownership_transfers_previous_owner_user_id_fkey foreign key (previous_owner_user_id) references auth.users(id);
alter table public.ownership_transfers add constraint ownership_transfers_new_owner_user_id_fkey foreign key (new_owner_user_id) references auth.users(id);

alter table public.kvkk_consents add constraint kvkk_consents_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete cascade;
alter table public.kvkk_consents add constraint kvkk_consents_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.data_deletion_requests add constraint data_deletion_requests_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete cascade;
alter table public.data_deletion_requests add constraint data_deletion_requests_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.data_deletion_requests add constraint data_deletion_requests_handled_by_fkey foreign key (handled_by) references public.staff_users(id);

alter table public.audit_log add constraint audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.audit_log add constraint audit_log_actor_staff_id_fkey foreign key (actor_staff_id) references public.staff_users(id);

-- Additional (non-constraint-backing) indexes
create index idx_audit_tenant on public.audit_log using btree (tenant_id, created_at desc);
create index idx_maintenance_vehicle on public.maintenance_records using btree (vehicle_id);
create index idx_transfers_vehicle on public.ownership_transfers using btree (vehicle_id);
create index idx_vehicles_plate on public.vehicles using btree (plate);
create index idx_vehicles_tenant on public.vehicles using btree (tenant_id);
create unique index idx_vehicles_vin on public.vehicles using btree (vin) where (vin is not null);
