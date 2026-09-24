import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const { createVehicle } = require("@/lib/vehicleWrite");

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
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    const result = await createVehicle({ authHeader, body, client });
    return NextResponse.json(result.json, { status: result.status });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
