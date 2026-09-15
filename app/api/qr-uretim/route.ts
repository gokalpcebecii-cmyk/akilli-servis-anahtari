import { createServerSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

function randomCode(length = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const count = Math.min(Number(body.count) || 10, 500);
    const batchLabel = body.batch_label || "Parti " + new Date().toISOString().slice(0, 10);

    const supabase = createServerSupabase();
    const codes = [];

    for (let i = 0; i < count; i++) {
      let code = randomCode();
      let attempts = 0;
      while (attempts < 5) {
        const existingResult = await supabase.from("qr_keys").select("id").eq("code", code).maybeSingle();
        if (!existingResult.data) {
          break;
        }
        code = randomCode();
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
