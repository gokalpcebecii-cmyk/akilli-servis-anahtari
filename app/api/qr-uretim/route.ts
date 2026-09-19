import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
const { generateQrCode } = require("@/lib/qrToken");

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabase();

    const { data: staff } = await supabase
      .from("staff_users")
      .select("id, tenant_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!staff) {
      return NextResponse.json({ error: "QR üretimi için yetkili bir servis hesabı gerekli" }, { status: 403 });
    }

    const body = await req.json();
    const count = Math.min(Number(body.count) || 10, 500);
    const batchLabel = body.batch_label || "Parti " + new Date().toISOString().slice(0, 10);

    const codes = [];

    for (let i = 0; i < count; i++) {
      let code = generateQrCode();
      let attempts = 0;
      while (attempts < 5) {
        const existingResult = await supabase.from("qr_keys").select("id").eq("code", code).maybeSingle();
        if (!existingResult.data) {
          break;
        }
        code = generateQrCode();
        attempts = attempts + 1;
      }
      codes.push(code);
    }

    const rows = codes.map(function (code) {
      return { code: code, batch_label: batchLabel };
    });

    const insertResult = await supabase.from("qr_keys").insert(rows).select();

    if (insertResult.error) {
      return NextResponse.json({ error: insertResult.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, codes: insertResult.data });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
