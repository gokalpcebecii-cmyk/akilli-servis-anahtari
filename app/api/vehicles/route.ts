import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const { createVehicle } = require("@/lib/vehicleWrite");
import { withApiLog } from "@/lib/appEvents";

// PILOT FIX 03 (madde A1) → İKİNCİ düzeltme turu (madde 1) → ÜÇÜNCÜ
// düzeltme turu (madde 2/3): araç oluşturmanın GERÇEK kayıt katmanı.
//
// MADDE 2/3: bu route artık SERVİS-ROLÜ (RLS'yi bypass eden) istemci
// KULLANMIYOR. `client`, yalnızca çağıranın KENDİ JWT'siyle (anon-key +
// Authorization header) kurulmuş, RLS'ye TABİ bir istemcidir — hem kimlik
// doğrulaması (.auth.getUser()) hem de tüm okuma/yazma bu TEK istemciyle
// yapılıyor. Güvenlik karar mantığının tamamı (owner/tenant türetimi,
// doğrulama, mükerrer kontrol) lib/vehicleWrite.js'de, bu geçişin RLS
// politikalarıyla uyumlu olduğu salt-okunur bir incelemeyle doğrulandı
// (bkz. o dosyanın başındaki not ve final rapor). Hiçbir DB/RLS/migration
// değişikliği yapılmadı.
async function handlePOST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    // Bireysel kullanıcıda aktivasyon doğrulaması zorunludur; servis hesapları
    // (staff) bu kapıdan muaftır. Verification RPC'si p_vehicle_id null ile
    // yalnız ürünü aktive edilebilirliğini + kodu doğrular.
    const userCheck = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );
    const { data: userData } = await userCheck.auth.getUser();
    let isServis = false;
    if (userData?.user) {
      const { data: staffRow } = await userCheck.from("staff_users").select("tenant_id").eq("id", userData.user.id).maybeSingle();
      isServis = !!(staffRow && staffRow.tenant_id);
    }
    if (!isServis) {
      const code = String((body && body.activation_code) || "");
      const identifier = String((body && body.activation_serial) || "");
      if (!identifier || !code) {
        return NextResponse.json({ error: "Araç oluşturmak için geçerli bir OTOİZ ürün aktivasyonu gerekir." }, { status: 403 });
      }
      const { data: verData, error: verErr } = await client.rpc("activate_product", {
        p_identifier: identifier,
        p_code: code,
        p_vehicle_id: null,
      });
      if (verErr || !verData || verData.ok !== true) {
        return NextResponse.json({ error: "Ürün aktivasyonu doğrulanamadı. Lütfen aktivasyon kodunu kontrol edin." }, { status: 403 });
      }
    }

    const result = await createVehicle({ authHeader, body, client });

    // Servis akışı aynen devam eder. Bireysel akışta araç oluşturulduktan sonra
    // ürün aynı istek içinde araca bağlanır; bind başarısızsa yeni araç geri alınır.
    if (!isServis && result.status >= 200 && result.status < 300 && result.json?.vehicle?.id) {
      const vehicleId = result.json.vehicle.id;
      const code = String((body && body.activation_code) || "");
      const identifier = String((body && body.activation_serial) || "");

      const { data: bindData, error: bindErr } = await client.rpc("activate_product", {
        p_identifier: identifier,
        p_code: code,
        p_vehicle_id: vehicleId,
      });

      if (bindErr || !bindData || bindData.ok !== true) {
        const { error: rollbackErr } = await client.from("vehicles").delete().eq("id", vehicleId);
        if (rollbackErr) {
          return NextResponse.json(
            { error: "Ürün araca bağlanamadı ve araç kaydı geri alınamadı. Lütfen OTOİZ desteğe başvurun." },
            { status: 500 }
          );
        }
        return NextResponse.json(
          { error: "Ürün araca bağlanamadı. Araç kaydı oluşturulmadı." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(result.json, { status: result.status });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLog("/api/vehicles", handlePOST);
