// OTOİZ platform yöneticisi (proje sahibi) yetki kontrolü — YALNIZ sunucu
// tarafında (app/api/admin/*) kullanılır.
//
// Kural: çağıranın kimliği kendi JWT'si ile doğrulanır (anon key +
// Authorization header, RLS'ye tabi istemci), ardından service_role ile
// public.platform_admins tablosunda kaydı olup olmadığına bakılır. Bu tablo
// anon/authenticated rollerine TAMAMEN kapalıdır (bkz. migration
// platform_admin_and_qr_reservation) — bir kullanıcı kendini yönetici
// yapamaz, yönetici listesini okuyamaz.
//
// P0 (2026-09-28): yönetici isteklerinde iki adımlı doğrulama (TOTP) zorunlu.
// Oturum token'ı "aal2" değilse (yalnız şifreyle girilmişse) 403
// { error: "mfa_required" } döner; panel doğrulayıcı kurulumunu / kod adımını
// gösterir. Yönetici olmayan hesaplar yine yalnız "forbidden" görür.
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
const { adminMfaEnforced, tokenAal } = require("@/lib/adminMfa");

export type AdminContext = {
  userId: string;
  email: string | null;
  db: ReturnType<typeof createServerSupabase>;
};

export async function requireAdmin(req: NextRequest): Promise<AdminContext | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: authHeader }, fetch: (i: any, o?: any) => fetch(i, { ...(o || {}), cache: "no-store" }) },
      auth: { persistSession: false },
    }
  );
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServerSupabase();
  const { data: admin } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Token getUser ile Auth sunucusunda doğrulandı; içindeki aal güvenilir.
  if (adminMfaEnforced(process.env) && tokenAal(authHeader) !== "aal2") {
    return NextResponse.json({ error: "mfa_required" }, { status: 403 });
  }

  return { userId: user.id, email: user.email ?? null, db };
}

export function isAdminContext(x: AdminContext | NextResponse): x is AdminContext {
  return (x as AdminContext).userId !== undefined;
}
