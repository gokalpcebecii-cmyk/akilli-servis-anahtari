// İkinci düzeltme turu (madde 1) → ÜÇÜNCÜ düzeltme turu (madde 2/3):
// /api/vehicles route.ts'in GÜVENLİK KRİTİK karar mantığı — kimin adına,
// hangi owner/tenant ile araç yazılacağı — saf bir modüle çıkarıldı.
//
// MADDE 2/3 GÜNCELLEMESİ: bu fonksiyon artık servis-rolü (RLS bypass eden)
// bir istemci KULLANMIYOR. Tüm okuma/yazma, doğrulanmış kullanıcının KENDİ
// JWT'sine bağlı, RLS'ye TABİ bir istemciyle yapılıyor (route.ts'te
// `client` parametresi = anon-key + Authorization: Bearer <kullanıcı JWT>
// ile oluşturulan istemci). Bu değişiklik yalnızca UYGULAMA KODUNDA
// yapıldı — hiçbir DB/RLS/migration değişikliği YOK.
//
// Bu geçişin güvenli olduğu, projenin GERÇEK RLS politikaları salt-okunur
// olarak incelenerek (Supabase MCP `execute_sql`/`list_tables` ile
// pg_policies sorgulandı, HİÇBİR satır değiştirilmedi) doğrulandı:
//   - vehicles: "owner_modify_own_vehicles" (ALL, USING/CHECK:
//     owner_user_id = auth.uid()) ve "staff_modify_own_tenant_vehicles"
//     (ALL, USING/CHECK: tenant_id IN (kendi tenant'ı)). Bu fonksiyonun
//     hesapladığı owner_user_id/tenant_id DEĞERLERİ bu politikaların
//     WITH CHECK koşuluyla birebir aynı — insert bu yüzden RLS altında
//     da başarılı olur.
//   - staff_users: "staff_select_own_row" (SELECT, id = auth.uid()) —
//     kullanıcı yalnızca kendi satırını okuyabilir, zaten ihtiyacımız bu.
// Bu inceleme salt-okunur SQL ile yapıldı (SELECT ... FROM pg_policies),
// hiçbir INSERT/UPDATE/DDL çalıştırılmadı.
//
// GÜVENLİK DAVRANIŞI (bilerek, testlerle kanıtlanmış — ama bkz. aşağıdaki
// "test kapsamı" notu):
//   - owner_user_id ve tenant_id HİÇBİR ZAMAN request body'sinden okunmaz.
//     Her ikisi de yalnızca doğrulanmış oturumdan (client.auth.getUser())
//     ve o kullanıcı kimliğiyle yapılan staff_users sorgusundan türetilir.
//   - authHeader yoksa veya token geçersizse HİÇBİR sorgu/yazma çalışmadan
//     401 dönülür.
//   - Geçersiz gövdede (validateVehicleInput/isValidNextServiceKm/
//     isValidNextServiceDate) hiçbir satır yazılmaz — insert çağrısına
//     asla ulaşılmaz.
//   - Aynı kapsamda aynı kanonik plaka zaten varsa 409 döner, insert
//     çağrılmaz — ardışık çift gönderimde ikinci istek burada durur.
//     NOT: bu, TAM EŞZAMANLI (mikrosaniye düzeyinde) iki isteğe karşı DB
//     seviyesinde garanti VERMEZ — bunun için (tenant_id/owner_user_id,
//     plaka) üzerinde bir UNIQUE kısıt (migration) gerekir. Bu SADECE
//     ÖNERİ olarak SECURITY_FIX_04_PROPOSAL.md'de yazıldı, uygulanmadı.
//
// TEST KAPSAMI NOTU (üçüncü düzeltme turu madde 1 — önceki "entegrasyon
// testi" ifadesi hatalıydı, düzeltildi): tests/vehicleWrite.test.js bu
// fonksiyonu SAHTE (gerçek Supabase SDK'sının arayüzünü taklit eden)
// istemcilerle çağırır. Bunlar SERVİS/ROUTE MANTIĞI testleridir — gerçek
// üretim kod yolunu (bir UI mock'u değil) çalıştırırlar, ama gerçek
// Supabase Auth doğrulamasını, gerçek RLS politika değerlendirmesini,
// gerçek DB trigger'larını veya gerçek audit_log yazımını KANITLAMAZ. Bu
// sandbox ortamının Supabase'e ağ erişimi olmadığı için (egress politikası
// engelliyor) tam uçtan-uca HTTP/DB entegrasyon testi bu ortamda mümkün
// değil. RLS politikalarının YUKARIDA açıklanan uyumu, testlerin
// KENDİSİYLE değil, ayrı bir salt-okunur MCP incelemesiyle doğrulandı.

const { validateVehicleInput, isValidNextServiceKm, isValidNextServiceDate } = require("./logic");

async function createVehicle({ authHeader, body, client }) {
  if (!authHeader) {
    return { status: 401, json: { error: "unauthorized" } };
  }

  const { data: userData } = await client.auth.getUser();
  if (!userData || !userData.user) {
    return { status: 401, json: { error: "unauthorized" } };
  }
  const userId = userData.user.id;

  const { data: staff } = await client.from("staff_users").select("tenant_id").eq("id", userId).maybeSingle();
  const isServis = !!(staff && staff.tenant_id);

  // 2026-09-24 servis güven modeli: yalnız platform yöneticisinin ONAYLADIĞI
  // servis araç kaydı oluşturabilir (RLS de aynı kuralı uygular; bu kontrol
  // kullanıcıya anlaşılır bir mesaj vermek içindir).
  if (isServis) {
    const { data: tenant } = await client.from("tenants").select("approval_status").eq("id", staff.tenant_id).maybeSingle();
    if (!tenant || tenant.approval_status !== "approved") {
      return {
        status: 403,
        json: { error: "İşletmeniz henüz OTOİZ tarafından onaylanmadı. Onaydan sonra araç ekleyebilirsiniz." },
      };
    }
  }

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

  let dupQuery = client.from("vehicles").select("id").eq("plate", normalized.plate);
  dupQuery = isServis ? dupQuery.eq("tenant_id", staff.tenant_id) : dupQuery.eq("owner_user_id", userId);
  const { data: existing } = await dupQuery.maybeSingle();
  if (existing) {
    return { status: 409, json: { errors: { plate: "Bu plakayla zaten bir araç kayıtlı." } } };
  }

  // GÜVENLİK: owner_user_id/tenant_id yalnızca yukarıdaki doğrulanmış
  // userId ve staff_users sorgusundan geliyor — body'nin bu alanları hiç
  // okunmadı. Bu değerler AYNI ZAMANDA RLS'nin owner_modify_own_vehicles/
  // staff_modify_own_tenant_vehicles WITH CHECK koşuluyla birebir eşleşir
  // — RLS, uygulama kodunda bir hata olsa bile son savunma katmanı olarak
  // devrede kalır (madde 2).
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

  const { data: created, error } = await client.from("vehicles").insert(insertPayload).select().single();
  if (error) {
    return { status: 400, json: { error: error.message } };
  }
  return { status: 200, json: { vehicle: created } };
}

module.exports = { createVehicle };
