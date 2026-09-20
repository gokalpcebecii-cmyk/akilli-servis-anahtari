import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const { createVehicle } = require("@/lib/vehicleWrite");

// PILOT FIX 03 (madde A1) + İKİNCİ DÜZELTME TURU (madde 1): araç
// oluşturmanın GERÇEK kayıt katmanı. Bu dosya yalnızca gerçek Supabase
// istemcilerini kurup Next.js request/response'a bağlıyor — GÜVENLİK
// KARAR MANTIĞININ TAMAMI (owner/tenant türetimi, doğrulama, mükerrer
// kontrol) lib/vehicleWrite.js içinde, sahte istemcilerle doğrudan test
// edilebilen saf bir fonksiyonda yaşıyor (bkz. tests/vehicleWrite.test.js).
//
// RLS/Auth modeli DEĞİŞMEDİ: bu route servis-rolü istemcisini yalnızca
// qr-eslestir route'unun zaten kullandığı desenle (kullanıcıyı Authorization
// header'ından doğrula, yetki kapsamını (owner_user_id/tenant_id) burada
// KENDİ SORGUSUYLA belirle) kullanıyor — mevcut policy'lere dokunmuyor,
// yalnızca bu tek yazma yolunun önüne bir doğrulama katmanı ekliyor.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );
    const serverClient = createServerSupabase();

    const result = await createVehicle({ authHeader, body, userClient, serverClient });
    return NextResponse.json(result.json, { status: result.status });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
