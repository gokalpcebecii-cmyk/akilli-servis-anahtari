-- DRIFT KAYDI: Bu migration staging'e repo DIŞINDAN uygulanmıştı (22.09.2026 21:27 UTC).
-- Tarihçenin staging ile birebir eşleşmesi için olduğu gibi kaydedildi.
-- Etkisi 20260922222343_relock_qr_keys_and_vehicle_tenant_guard ile GERİ ALINDI.
-- Production'a UYGULANMAMALIDIR.

create policy "owner_insert_own_vehicle_qr_keys"
on qr_keys for insert
with check (
  vehicle_id in (select id from vehicles where owner_user_id = auth.uid())
);

create policy "owner_update_own_vehicle_qr_keys"
on qr_keys for update
using (
  vehicle_id in (select id from vehicles where owner_user_id = auth.uid())
)
with check (
  vehicle_id in (select id from vehicles where owner_user_id = auth.uid())
);

create policy "staff_insert_own_tenant_qr_keys"
on qr_keys for insert
with check (
  vehicle_id is null
  or vehicle_id in (
    select id from vehicles where tenant_id in (
      select tenant_id from staff_users where id = auth.uid()
    )
  )
);

create policy "staff_update_own_tenant_qr_keys"
on qr_keys for update
using (
  vehicle_id is null
  or vehicle_id in (
    select id from vehicles where tenant_id in (
      select tenant_id from staff_users where id = auth.uid()
    )
  )
)
with check (
  vehicle_id is null
  or vehicle_id in (
    select id from vehicles where tenant_id in (
      select tenant_id from staff_users where id = auth.uid()
    )
  )
);
