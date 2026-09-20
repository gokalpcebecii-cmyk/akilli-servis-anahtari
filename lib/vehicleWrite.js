// İkinci düzeltme turu, madde 1: /api/vehicles route.ts'in GÜVENLİK
// KRİTİK karar mantığı — kimin adına, hangi owner/tenant ile araç
// yazılacağı — saf, servis-rolü olmayan bir modüle çıkarıldı. Bu, gerçek
// üretim mantığını (bir UI mock'u değil) sahte Supabase istemcileriyle
// doğrudan çağırıp test edebilmemizi sağlıyor (bkz. tests/vehicleWrite.test.js).
//
// GÜVENLİK DAVRANIŞI (bilerek, testlerle kanıtlanmış):
//   - owner_user_id ve tenant_id HİÇBİR ZAMAN request body'sinden okunmaz.
//     Her ikisi de yalnızca doğrulanmış oturumdan (userClient.auth.getUser())
//     ve o kullanıcı kimliğiyle sunucu tarafında yapılan staff_users
//     sorgusundan türetilir. Body'de owner_user_id/tenant_id gönderilse
//     bile insertPayload bunları asla okumaz — bu yüzden aşağıdaki
//     fonksiyon body objesinden bu iki alanı hiç DESTRUCTURE ETMİYOR bile.
//   - authHeader yoksa veya token geçersizse (userClient.auth.getUser()
//     kullanıcı döndürmezse) HİÇBİR sorgu/yazma çalışmadan 401 dönülür.
//   - Geçersiz gövdede (validateVehicleInput/isValidNextServiceKm) hiçbir
//     satır yazılmaz — insert çağrısına asla ulaşılmaz.
//   - Aynı kapsamda (kendi owner_user_id / kendi tenant_id) aynı kanonik
//     plaka zaten varsa 409 döner, insert çağrılmaz — ardışık çift
//     gönderimde (çift tık/Enter+tık/ağ tekrarı) ikinci istek bu kontrolde
//     durur. NOT: bu, iki isteğin TAM AYNI ANDA (mikrosaniye düzeyinde eş
//     zamanlı) sunucuya ulaştığı bir yarış durumunu DB seviyesinde garanti
//     ALTINA ALMAZ — bunun için tenant_id/owner_user_id + plaka üzerinde
//     bir UNIQUE kısıt (migration) gerekir; bu görev migration yapılmasını
//     yasakladığı için bu, ayrı bir teknik ihtiyaç olarak bildirildi
//     (bkz. final rapor). Gerçekçi çift-tık/Enter+tık senaryosunda (istekler
//     arasında ağ/işlem gecikmesi olan ardışık istekler) bu kontrol pratikte
//     etkilidir ve testlerle kanıtlanmıştır.

const { validateVehicleInput, isValidNextServiceKm, isValidNextServiceDate } = require("./logic");

async function createVehicle({ authHeader, body, userClient, serverClient }) {
  if (!authHeader) {
    return { status: 401, json: { error: "unauthorized" } };
  }

  const { data: userData } = await userClient.auth.getUser();
  if (!userData || !userData.user) {
    return { status: 401, json: { error: "unauthorized" } };
  }
  const userId = userData.user.id;

  const { data: staff } = await serverClient.from("staff_users").select("tenant_id").eq("id", userId).maybeSingle();
  const isServis = !!(staff && staff.tenant_id);

  const { valid, errors, normalized } = validateVehicleInput({
    plate: body && body.plate,
    brand: body && body.brand,
    model: body && body.model,
    year: body && body.year,
    current_km: body && body.current_km,
  });
  if (!valid) {
    return { status: 400, json: { errors } };
  }

  const nextServiceKm =
    !body || body.next_service_km === "" || body.next_service_km == null ? null : Number(body.next_service_km);
  if (nextServiceKm != null && !isValidNextServiceKm(normalized.current_km, nextServiceKm)) {
    return {
      status: 400,
      json: { errors: { next_service_km: "Sonraki bakım kilometresi, güncel kilometreden büyük olmalı." } },
    };
  }
  const nextServiceDate = (body && body.next_service_date) || null;
  if (nextServiceDate && !isValidNextServiceDate(nextServiceDate)) {
    return {
      status: 400,
      json: { errors: { next_service_date: "Sonraki bakım tarihi geçmişte olamaz." } },
    };
  }

  let dupQuery = serverClient.from("vehicles").select("id").eq("plate", normalized.plate);
  dupQuery = isServis ? dupQuery.eq("tenant_id", staff.tenant_id) : dupQuery.eq("owner_user_id", userId);
  const { data: existing } = await dupQuery.maybeSingle();
  if (existing) {
    return { status: 409, json: { errors: { plate: "Bu plakayla zaten bir araç kayıtlı." } } };
  }

  // GÜVENLİK: owner_user_id/tenant_id yalnızca yukarıdaki doğrulanmış
  // userId ve sunucu tarafı staff_users sorgusundan geliyor — body'nin
  // bu alanları hiç okunmadı, okunması da mümkün değil (aşağıda yok).
  const insertPayload = {
    plate: normalized.plate,
    brand: normalized.brand,
    model: normalized.model,
    year: normalized.year,
    current_km: normalized.current_km,
    next_service_km: nextServiceKm,
    next_service_date: nextServiceDate,
    owner_user_id: isServis ? null : userId,
    tenant_id: isServis ? staff.tenant_id : null,
  };

  const { data: created, error } = await serverClient.from("vehicles").insert(insertPayload).select().single();
  if (error) {
    return { status: 400, json: { error: error.message } };
  }
  return { status: 200, json: { vehicle: created } };
}

module.exports = { createVehicle };
