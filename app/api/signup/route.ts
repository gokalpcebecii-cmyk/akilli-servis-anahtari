import { createServerSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
const { validatePassword } = require("@/lib/passwordPolicy");

function slugify(text: string) {
  const trMap: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  let result = text.split("").map((c) => trMap[c] || c).join("");
  result = result.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${result}-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { business_name, email, password, phone, address } = body;

    if (!business_name || !email || !password) {
      return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError || !userData.user) {
      return NextResponse.json({ error: userError?.message || "Kullanıcı oluşturulamadı" }, { status: 400 });
    }

    const slug = slugify(business_name);

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({ name: business_name, slug, phone: phone || null, address: address || null })
      .select()
      .single();

    if (tenantError || !tenant) {
      await supabase.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json({ error: "İşletme kaydı oluşturulamadı" }, { status: 400 });
    }

    const { error: staffError } = await supabase.from("staff_users").insert({
      id: userData.user.id,
      tenant_id: tenant.id,
      full_name: business_name,
      role: "owner",
    });

    if (staffError) {
      await supabase.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json({ error: "Personel kaydı oluşturulamadı" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu" }, { status: 500 });
  }
}
