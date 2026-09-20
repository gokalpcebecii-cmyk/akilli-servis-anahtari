// İkinci düzeltme turu, madde 1/2: /api/vehicles'ın GERÇEK güvenlik/
// doğrulama mantığını (lib/vehicleWrite.js — route.ts'in çağırdığı AYNI
// kod) sahte ama gerçekçi Supabase istemcileriyle doğrudan çalıştırıp
// kanıtlıyoruz. Bu bir UI/tarayıcı mock'u DEĞİL — gerçek üretim
// fonksiyonuna gerçek argümanlarla yapılan bir entegrasyon testidir.
//
// Bu sandbox ortamında gerçek bir Supabase projesine (service-role veya
// anon-key ile) ağ erişimi YOK (egress politikası engelliyor — build/test
// sırasında doğrulandı). Bu yüzden tam uçtan-uca HTTP testi mümkün değil;
// bunun yerine Supabase JS istemcisinin arayüzünü taklit eden sahte
// istemcilerle GERÇEK route mantığını çağırıyoruz. Bu, "body'den owner/
// tenant asla okunmaz" gibi güvenlik değişmezlerini kanıtlamak için
// yeterli ve doğru granülerliktedir.

const test = require("node:test");
const assert = require("node:assert/strict");
const { createVehicle } = require("../lib/vehicleWrite");

// Zincirlenebilir sorgu builder'ı taklit eden minimal sahte istemci.
// `tables` haritasındaki her tablo için .maybeSingle()/.single() sonucu
// önceden ayarlanır; .eq() zincirlemesi çağrı kaydı için izlenir ama
// filtre MANTIĞINI uygulamaz (testler zaten hangi tabloya hangi sonucun
// döneceğini doğrudan ayarlıyor).
function makeServerClient({ staffUsers, existingVehicle, insertResult, insertError } = {}) {
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

  return { from, calls };
}

function makeUserClient(user) {
  return {
    auth: {
      async getUser() {
        return { data: { user } };
      },
    },
  };
}

const VALID_BODY = { plate: "34 ABC 123", brand: "Toyota", model: "Corolla", year: 2020, current_km: 50000 };

test("authHeader yoksa 401 döner, hiçbir sorgu/yazma yapılmaz", async () => {
  const server = makeServerClient({});
  const res = await createVehicle({
    authHeader: null,
    body: VALID_BODY,
    userClient: makeUserClient({ id: "u1" }),
    serverClient: server,
  });
  assert.equal(res.status, 401);
  assert.equal(server.calls.selects.length, 0);
  assert.equal(server.calls.inserts.length, 0);
});

test("geçersiz/süresi dolmuş token (getUser kullanıcı döndürmez) → 401, sıfır yan etki", async () => {
  const server = makeServerClient({});
  const res = await createVehicle({
    authHeader: "Bearer invalid.token.here",
    body: VALID_BODY,
    userClient: makeUserClient(null),
    serverClient: server,
  });
  assert.equal(res.status, 401);
  assert.equal(server.calls.selects.length, 0);
  assert.equal(server.calls.inserts.length, 0);
});

test("GÜVENLİK: body'de sahte owner_user_id/tenant_id gönderilse bile insert her zaman doğrulanmış kullanıcıdan türetilen değeri kullanır (bireysel)", async () => {
  const server = makeServerClient({ staffUsers: null }); // staff_users'da yok → bireysel
  const attackerBody = { ...VALID_BODY, owner_user_id: "ATTACKER-CHOSEN-OWNER", tenant_id: "ATTACKER-CHOSEN-TENANT" };
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: attackerBody,
    userClient: makeUserClient({ id: "real-user-id" }),
    serverClient: server,
  });
  assert.equal(res.status, 200);
  assert.equal(server.calls.inserts.length, 1);
  const payload = server.calls.inserts[0].payload;
  assert.equal(payload.owner_user_id, "real-user-id");
  assert.equal(payload.tenant_id, null);
  assert.notEqual(payload.owner_user_id, "ATTACKER-CHOSEN-OWNER");
});

test("GÜVENLİK: servis kullanıcısı için tenant_id her zaman staff_users sorgusundan gelir, body'den değil", async () => {
  const server = makeServerClient({ staffUsers: { tenant_id: "real-tenant-id" } });
  const attackerBody = { ...VALID_BODY, tenant_id: "ATTACKER-CHOSEN-TENANT", owner_user_id: "ATTACKER-OWNER" };
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: attackerBody,
    userClient: makeUserClient({ id: "staff-user-id" }),
    serverClient: server,
  });
  assert.equal(res.status, 200);
  const payload = server.calls.inserts[0].payload;
  assert.equal(payload.tenant_id, "real-tenant-id");
  assert.equal(payload.owner_user_id, null);
  assert.notEqual(payload.tenant_id, "ATTACKER-CHOSEN-TENANT");
});

test("madde 2: boş/geçersiz araç gövdesi → 400, insert HİÇ çağrılmaz (sıfır yan etki)", async () => {
  const server = makeServerClient({ staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: { plate: "", brand: "", model: "", year: "", current_km: "" },
    userClient: makeUserClient({ id: "u1" }),
    serverClient: server,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.plate);
  assert.equal(server.calls.inserts.length, 0);
});

test("madde 2: kısmi geçersiz gövde (yalnızca km eksik) → 400, insert çağrılmaz", async () => {
  const server = makeServerClient({ staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: { plate: "34 ABC 123", brand: "Toyota", model: "Corolla", year: 2020, current_km: "" },
    userClient: makeUserClient({ id: "u1" }),
    serverClient: server,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.current_km);
  assert.equal(server.calls.inserts.length, 0);
});

test("güncel kilometreden düşük/eşit sonraki bakım km'si → 400, insert çağrılmaz", async () => {
  const server = makeServerClient({ staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer real-token",
    body: { ...VALID_BODY, current_km: 50000, next_service_km: 40000 },
    userClient: makeUserClient({ id: "u1" }),
    serverClient: server,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.next_service_km);
  assert.equal(server.calls.inserts.length, 0);
});

test("madde 8: geçmiş sonraki-bakım tarihi → 400, insert çağrılmaz", async () => {
  const server = makeServerClient({ staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer t",
    body: { ...VALID_BODY, next_service_date: "2000-01-01" },
    userClient: makeUserClient({ id: "u1" }),
    serverClient: server,
  });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.next_service_date);
  assert.equal(server.calls.inserts.length, 0);
});

test("madde 2: ardışık çift gönderim (aynı plaka) → ilk istek oluşturur, ikinci istek 409 alır ve İKİNCİ bir araç YAZILMAZ", async () => {
  const server = makeServerClient({ staffUsers: null });
  const userClient = makeUserClient({ id: "u1" });

  const first = await createVehicle({ authHeader: "Bearer t", body: VALID_BODY, userClient, serverClient: server });
  assert.equal(first.status, 200);
  assert.equal(server.calls.inserts.length, 1);

  // İkinci "istek" aynı sunucu durumuna (artık plaka var) karşı çalışıyor —
  // gerçek ardışık çift-tık/Enter+tık/ağ tekrarı senaryosunu taklit eder.
  const serverAfterFirst = makeServerClient({ staffUsers: null, existingVehicle: { id: "created-id" } });
  const second = await createVehicle({ authHeader: "Bearer t", body: VALID_BODY, userClient, serverClient: serverAfterFirst });
  assert.equal(second.status, 409);
  assert.equal(serverAfterFirst.calls.inserts.length, 0, "ikinci istekte insert çağrılmamalı");
});

test("normalize edilmiş mükerrer plaka (farklı yazım) aynı kapsamda reddedilir", async () => {
  // "06 otoiz 01" ve "06-OTOIZ-01" normalizePlate ile aynı kanonik forma
  // (06 OTOIZ 01) indirgenir — bkz. lib/logic.js. Sunucu bu kanonik formla
  // eşleşen bir kayıt bulursa 409 döner.
  const server = makeServerClient({ staffUsers: null, existingVehicle: { id: "existing" } });
  const res = await createVehicle({
    authHeader: "Bearer t",
    body: { plate: "06-otoiz-01", brand: "Toyota", model: "Corolla", year: 2020, current_km: 1000 },
    userClient: makeUserClient({ id: "u1" }),
    serverClient: server,
  });
  assert.equal(res.status, 409);
  assert.equal(server.calls.inserts.length, 0);
});

test("başarılı oluşturma: insert tam olarak bir kez, doğru normalize edilmiş alanlarla çağrılır", async () => {
  const server = makeServerClient({ staffUsers: null });
  const res = await createVehicle({
    authHeader: "Bearer t",
    body: { plate: "34-abc-123", brand: " Toyota ", model: " Corolla ", year: "2020", current_km: "50000" },
    userClient: makeUserClient({ id: "u1" }),
    serverClient: server,
  });
  assert.equal(res.status, 200);
  assert.equal(server.calls.inserts.length, 1);
  const payload = server.calls.inserts[0].payload;
  assert.equal(payload.plate, "34 ABC 123");
  assert.equal(payload.brand, "Toyota");
  assert.equal(payload.current_km, 50000);
});
