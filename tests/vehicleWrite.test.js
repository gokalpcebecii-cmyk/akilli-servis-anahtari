// ÜÇÜNCÜ düzeltme turu, madde 1: bu dosya önceden "entegrasyon testi"
// olarak adlandırılmıştı — bu YANLIŞTI, düzeltildi. Bunlar SERVİS/ROUTE
// MANTIĞI TESTLERİdir: lib/vehicleWrite.js'in GERÇEK üretim kodunu
// (route.ts'in çağırdığı AYNI fonksiyon, bir UI/tarayıcı mock'u DEĞİL)
// sahte — gerçek Supabase JS istemcisinin arayüzünü taklit eden —
// istemcilerle doğrudan çalıştırırlar.
//
// BU TESTLERİN KANITLADIĞI: createVehicle() fonksiyonunun kendi iç
// mantığı — owner/tenant'ın body'den değil doğrulanmış kimlikten
// türetildiği, geçersiz girdide insert'e hiç ulaşılmadığı, mükerrer
// kontrolün çalıştığı.
//
// BU TESTLERİN KANITLAMADIĞI (önemli, önceki turda "entegrasyon testi"
// denilerek fazla iddialı sunulmuştu): gerçek Supabase Auth'un token
// doğrulaması, gerçek RLS politikalarının bu isteklere nasıl davrandığı,
// gerçek DB trigger'ları (log_vehicle_created vb.), gerçek audit_log
// yazımı veya gerçek Postgres UNIQUE/foreign-key kısıtları. Bu sandbox
// ortamının Supabase'e ağ erişimi yok (egress politikası engelliyor —
// doğrulandı), bu yüzden tam uçtan-uca DB entegrasyon testi burada
// çalıştırılamıyor. RLS politikalarının bu route'un davranışıyla uyumlu
// olduğu, bu testlerle DEĞİL, ayrı bir salt-okunur Supabase MCP
// incelemesiyle (pg_policies sorgusu, sıfır yazma) doğrulandı — bkz.
// lib/vehicleWrite.js başındaki not ve final rapor.

const test = require("node:test");
const assert = require("node:assert/strict");
const { createVehicle } = require("../lib/vehicleWrite");

// Zincirlenebilir sorgu builder'ı + .auth.getUser() taklit eden minimal
// sahte istemci. `tables` haritasındaki her tablo için .maybeSingle()
// sonucu önceden ayarlanır; .eq() zincirlemesi çağrı kaydı için izlenir
// ama filtre MANTIĞINI uygulamaz (testler zaten hangi tabloya hangi
// sonucun döneceğini doğrudan ayarlıyor). Bu bir Supabase/RLS/Postgres
// SİMÜLASYONU değildir — yalnızca JS arayüzünü taklit eder.
function makeClient({ user, staffUsers, existingVehicle, insertResult, insertError, tenant } = {}) {
  const calls = { selects: [], inserts: [] };

  function from(table) {
    return {
      select(cols) {
        const record = { table, cols, eq: [] };
        const builder = {
          eq(col, val) {
            record.eq.push([col, val]);
            return builder;
          },
          async maybeSingle() {
            calls.selects.push(record);
            if (table === "staff_users") return { data: staffUsers ?? null };
            if (table === "vehicles") return { data: existingVehicle ?? null };
            if (table === "tenants") return { data: tenant === undefined ? { approval_status: "approved" } : tenant };
            return { data: null };
          },
          async single() {
            return builder.maybeSingle();
          },
        };
        return builder;
      },
      insert(payload) {
        calls.inserts.push({ table, payload });
        return {
          select() {
            return {
              async single() {
                if (insertError) return { data: null, error: insertError };
                return { data: insertResult ?? { id: "created-id", ...payload }, error: null };
              },
            };
          },
        };
      },
    };
  }

  return {
    from,
    calls,
    auth: {
      async getUser() {
        return { data: { user } };
      },
    },
  };
}

const VALID_BODY = { plate: "34 ABC 123", brand: "Toyota", model: "Corolla", year: 2020, current_km: 50000 };

test("authHeader yoksa 401 döner, hiçbir sorgu/yazma yapılmaz", async () => {
  const client = makeClient({ user: { id: "u1" } });
  const res = await createVehicle({ authHeader: null, body: VALID_BODY, client });
  assert.equal(res.status, 401);
  assert.equal(client.calls.selects.length, 0);
  assert.equal(client.calls.inserts.length, 0);
});

test("geçersiz/süresi dolmuş token (getUser kullanıcı döndürmez) → 401, sıfır yan etki", async () => {
  const client = makeClient({ user: null });
  const res = await createVehicle({ authHeader: "Bearer invalid.token.here", body: VALID_BODY, client });
  assert.equal(res.status, 401);
  assert.equal(client.calls.selects.length, 0);
  assert.equal(client.calls.inserts.length, 0);
});

test("body'de sahte owner_user_id/tenant_id gönderilse bile insert her zaman doğrulanmış kullanıcıdan türetilen değeri kullanır (bireysel)", async () => {
  const client = makeClient({ user: { id: "real-user-id" }, staffUsers: null }); // staff_users'da yok → bireysel
  const attackerBody = { ...VALID_BODY, owner_user_id: "ATTACKER-CHOSEN-OWNER", tenant_id: "ATTACKER-CHOSEN-TENANT" };
  const res = await createVehicle({ authHeader: "Bearer real-token", body: attackerBody, client });
  assert.equal(res.status, 200);
  assert.equal(client.calls.inserts.length, 1);
  const payload = client.calls.inserts[0].payload;
  assert.equal(payload.owner_user_id, "real-user-id");
  assert.equal(payload.tenant_id, null);
  assert.notEqual(payload.owner_user_id, "ATTACKER-CHOSEN-OWNER");
});

test("servis kullanıcısı için tenant_id her zaman staff_users sorgusundan gelir, body'den değil", async () => {
  const client = makeClient({ user: { id: "staff-user-id" }, staffUsers: { tenant_id: "real-tenant-id" } });
  const attackerBody = { ...VALID_BODY, tenant_id: "ATTACKER-CHOSEN-TENANT", owner_user_id: "ATTACKER-OWNER" };
  const res = await createVehicle({ authHeader: "Bearer real-token", body: attackerBody, client });
  assert.equal(res.status, 200);
  const payload = client.calls.inserts[0].payload;
  assert.equal(payload.tenant_id, "real-tenant-id");
  assert.equal(payload.owner_user_id, null);
  assert.notEqual(payload.tenant_id, "ATTACKER-CHOSEN-TENANT");
});

test("madde 2: boş/geçersiz araç gövdesi → 400, insert HİÇ çağrılmaz (sıfır yan etki)", async () => {
  const client = makeClient({ user: { id: "u1" }, staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: { plate: "", brand: "", model: "", year: "", current_km: "" },
    client,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.plate);
  assert.equal(client.calls.inserts.length, 0);
});

test("madde 2: kısmi geçersiz gövde (yalnızca km eksik) → 400, insert çağrılmaz", async () => {
  const client = makeClient({ user: { id: "u1" }, staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: { plate: "34 ABC 123", brand: "Toyota", model: "Corolla", year: 2020, current_km: "" },
    client,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.current_km);
  assert.equal(client.calls.inserts.length, 0);
});

test("güncel kilometreden düşük/eşit sonraki bakım km'si → 400, insert çağrılmaz", async () => {
  const client = makeClient({ user: { id: "u1" }, staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: { ...VALID_BODY, current_km: 50000, next_service_km: 40000 },
    client,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.next_service_km);
  assert.equal(client.calls.inserts.length, 0);
});

test("geçmiş sonraki-bakım tarihi → 400, insert çağrılmaz", async () => {
  const client = makeClient({ user: { id: "u1" }, staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer t",
    body: { ...VALID_BODY, next_service_date: "2000-01-01" },
    client,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.next_service_date);
  assert.equal(client.calls.inserts.length, 0);
});

test("madde 2: ardışık çift gönderim (aynı plaka) → ilk istek oluşturur, ikinci istek 409 alır ve İKİNCİ bir araç YAZILMAZ", async () => {
  const clientFirst = makeClient({ user: { id: "u1" }, staffUsers: null });
  const first = await createVehicle({ authHeader: "Bearer t", body: VALID_BODY, client: clientFirst });
  assert.equal(first.status, 200);
  assert.equal(clientFirst.calls.inserts.length, 1);

  // İkinci "istek" aynı sunucu durumuna (artık plaka var) karşı çalışıyor —
  // gerçek ardışık çift-tık/Enter+tık/ağ tekrarı senaryosunu taklit eder.
  const clientSecond = makeClient({ user: { id: "u1" }, staffUsers: null, existingVehicle: { id: "created-id" } });
  const second = await createVehicle({ authHeader: "Bearer t", body: VALID_BODY, client: clientSecond });
  assert.equal(second.status, 409);
  assert.equal(clientSecond.calls.inserts.length, 0, "ikinci istekte insert çağrılmamalı");
});

test("normalize edilmiş mükerrer plaka (farklı yazım) aynı kapsamda reddedilir", async () => {
  // "06 otoiz 01" ve "06-OTOIZ-01" normalizePlate ile aynı kanonik forma
  // (06 OTOIZ 01) indirgenir — bkz. lib/logic.js. Sunucu bu kanonik formla
  // eşleşen bir kayıt bulursa 409 döner.
  const client = makeClient({ user: { id: "u1" }, staffUsers: null, existingVehicle: { id: "existing" } });
  const res = await createVehicle({
    authHeader: "Bearer t",
    body: { plate: "06-otoiz-01", brand: "Toyota", model: "Corolla", year: 2020, current_km: 1000 },
    client,
  });
  assert.equal(res.status, 409);
  assert.equal(client.calls.inserts.length, 0);
});

test("başarılı oluşturma: insert tam olarak bir kez, doğru normalize edilmiş alanlarla çağrılır", async () => {
  const client = makeClient({ user: { id: "u1" }, staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer t",
    body: { plate: "34-abc-123", brand: " Toyota ", model: " Corolla ", year: "2020", current_km: "50000" },
    client,
  });
  assert.equal(res.status, 200);
  assert.equal(client.calls.inserts.length, 1);
  const payload = client.calls.inserts[0].payload;
  assert.equal(payload.plate, "34 ABC 123");
  assert.equal(payload.brand, "Toyota");
  assert.equal(payload.current_km, 50000);
});


test("createVehicle: onay bekleyen (pending) servis araç oluşturamaz — insert'e hiç ulaşılmaz", async () => {
  const client = makeClient({
    user: { id: "staff-1" },
    staffUsers: { tenant_id: "tenant-1" },
    tenant: { approval_status: "pending" },
  });
  const calls = client.calls;
  const result = await createVehicle({
    authHeader: "Bearer x",
    body: { plate: "34 ABC 123", brand: "Opel", model: "Astra", year: 2015, current_km: 1000 },
    client,
  });
  assert.equal(result.status, 403);
  assert.equal(calls.inserts.length, 0);
});

test("createVehicle: reddedilmiş (rejected) servis araç oluşturamaz", async () => {
  const client = makeClient({
    user: { id: "staff-1" },
    staffUsers: { tenant_id: "tenant-1" },
    tenant: { approval_status: "rejected" },
  });
  const calls = client.calls;
  const result = await createVehicle({
    authHeader: "Bearer x",
    body: { plate: "34 ABC 123", brand: "Opel", model: "Astra", year: 2015, current_km: 1000 },
    client,
  });
  assert.equal(result.status, 403);
  assert.equal(calls.inserts.length, 0);
});
